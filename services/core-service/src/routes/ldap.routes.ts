/**
 * LDAP Integration Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, authorize, ROLES, createLogger, AppError, NotFoundError, ValidationError, encrypt, decrypt } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'core-service' });

/**
 * GET /ldap/config
 * Get LDAP configuration
 */
router.get('/config', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await db.queryOne(
      `SELECT id, name, server_url, base_dn, bind_dn, user_search_base, user_filter, 
              group_search_base, group_filter, sync_schedule, is_active, last_sync_at, created_at
       FROM ldap_config WHERE tenant_id = $1`,
      [req.user!.tenantId]
    );
    res.json({ success: true, data: config || null });
  } catch (error) { next(error); }
});

/**
 * POST /ldap/config
 * Save or update LDAP configuration
 */
router.post('/config', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, server_url, base_dn, bind_dn, bind_password, user_search_base, user_filter, group_search_base, group_filter, sync_schedule, is_active } = req.body;
    
    if (!server_url || !base_dn || !bind_dn) {
      throw new ValidationError('Sunucu URL, Base DN ve Bind DN zorunludur');
    }
    
    const encryptedPassword = bind_password ? encrypt(bind_password) : undefined;
    
    const existing = await db.queryOne('SELECT id, bind_password_encrypted FROM ldap_config WHERE tenant_id = $1', [req.user!.tenantId]);
    
    let result;
    if (existing) {
      result = await db.queryOne(
        `UPDATE ldap_config SET name = $1, server_url = $2, base_dn = $3, bind_dn = $4,
           bind_password_encrypted = COALESCE($5, bind_password_encrypted),
           user_search_base = $6, user_filter = $7, group_search_base = $8, group_filter = $9,
           sync_schedule = $10, is_active = $11, updated_at = NOW()
         WHERE tenant_id = $12 RETURNING id, name, server_url, base_dn, is_active`,
        [name || 'Default LDAP', server_url, base_dn, bind_dn, encryptedPassword, user_search_base, user_filter, group_search_base, group_filter, sync_schedule || 'manual', is_active ?? false, req.user!.tenantId]
      );
    } else {
      if (!bind_password) throw new ValidationError('İlk kurulumda Bind Password zorunludur');
      result = await db.queryOne(
        `INSERT INTO ldap_config (tenant_id, name, server_url, base_dn, bind_dn, bind_password_encrypted, user_search_base, user_filter, group_search_base, group_filter, sync_schedule, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id, name, server_url, base_dn, is_active`,
        [req.user!.tenantId, name || 'Default LDAP', server_url, base_dn, bind_dn, encryptedPassword, user_search_base, user_filter || '(&(objectClass=user)(mail=*))', group_search_base, group_filter || '(objectClass=group)', sync_schedule || 'manual', is_active ?? false]
      );
    }
    
    logger.info('LDAP config saved', { user: req.user!.email, serverUrl: server_url });
    res.json({ success: true, data: result, message: 'LDAP ayarları kaydedildi' });
  } catch (error) { next(error); }
});

/**
 * POST /ldap/test
 * Test LDAP connection
 */
router.post('/test', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let { server_url, base_dn, bind_dn, bind_password } = req.body;
    
    if (!server_url || !bind_dn) throw new ValidationError('Sunucu URL ve Bind DN zorunludur');
    
    if (!server_url.startsWith('ldap://') && !server_url.startsWith('ldaps://')) {
      server_url = server_url.includes(':') ? `ldap://${server_url}` : `ldap://${server_url}:389`;
    }
    
    let password = bind_password;
    if (!password) {
      const config = await db.queryOne('SELECT bind_password_encrypted FROM ldap_config WHERE tenant_id = $1', [req.user!.tenantId]);
      if (config?.bind_password_encrypted) {
        password = decrypt(config.bind_password_encrypted);
      }
    }
    if (!password) throw new ValidationError('Şifre gerekli');
    
    const { Client } = await import('ldapts');
    const client = new Client({ url: server_url });
    
    try {
      await client.bind(bind_dn, password);
      const { searchEntries } = await client.search(base_dn, { scope: 'sub', filter: '(objectClass=*)', sizeLimit: 1 });
      await client.unbind();
      res.json({ success: true, message: 'LDAP bağlantısı başarılı!', data: { connected: true, baseDnAccessible: searchEntries.length > 0 } });
    } catch (ldapError: any) {
      await client.unbind().catch(() => {});
      let errorMessage = 'LDAP bağlantısı başarısız';
      if (ldapError.message.includes('Invalid credentials')) errorMessage = 'Geçersiz kullanıcı adı veya şifre';
      else if (ldapError.message.includes('ECONNREFUSED')) errorMessage = 'LDAP sunucusuna bağlanılamadı. Sunucu adresi ve portu kontrol edin.';
      else if (ldapError.message.includes('ETIMEDOUT')) errorMessage = 'LDAP sunucusu yanıt vermiyor. Firewall ayarlarını kontrol edin.';
      res.json({ success: false, message: errorMessage, error: ldapError.message });
    }
  } catch (error) { next(error); }
});

/**
 * GET /ldap/groups
 * Get LDAP groups
 */
router.get('/groups', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await db.queryOne('SELECT * FROM ldap_config WHERE tenant_id = $1', [req.user!.tenantId]);
    if (!config) throw new NotFoundError('LDAP yapılandırması');
    
    const password = decrypt(config.bind_password_encrypted);
    const { Client } = await import('ldapts');
    const client = new Client({ url: config.server_url });
    
    try {
      await client.bind(config.bind_dn, password);
      const searchBase = config.group_search_base || config.base_dn;
      const { searchEntries } = await client.search(searchBase, { scope: 'sub', filter: config.group_filter || '(objectClass=group)', attributes: ['cn', 'distinguishedName', 'description', 'member'] });
      await client.unbind();
      
      const groups = searchEntries.map((entry: any) => ({
        dn: entry.dn, name: entry.cn, description: entry.description,
        memberCount: Array.isArray(entry.member) ? entry.member.length : (entry.member ? 1 : 0)
      }));
      res.json({ success: true, data: groups });
    } catch (ldapError: any) {
      await client.unbind().catch(() => {});
      throw new AppError(`LDAP grup araması başarısız: ${ldapError.message}`, 500);
    }
  } catch (error) { next(error); }
});

/**
 * GET /ldap/position-mappings
 * List position mappings
 */
router.get('/position-mappings', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mappings = await db.queryAll(
      `SELECT m.id, m.ldap_group_dn, m.ldap_group_name, m.position_code, m.priority, p.name as position_name, p.hierarchy_level
       FROM ldap_position_mappings m JOIN positions p ON m.position_code = p.code WHERE m.tenant_id = $1 ORDER BY m.priority, p.hierarchy_level`,
      [req.user!.tenantId]
    );
    res.json({ success: true, data: mappings });
  } catch (error) { next(error); }
});

/**
 * POST /ldap/position-mappings
 * Add or update position mapping
 */
router.post('/position-mappings', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ldap_group_dn, ldap_group_name, position_code, priority } = req.body;
    if (!ldap_group_dn || !position_code) throw new ValidationError('LDAP grup DN ve pozisyon kodu zorunludur');
    
    const result = await db.queryOne(
      `INSERT INTO ldap_position_mappings (tenant_id, ldap_group_dn, ldap_group_name, position_code, priority)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, ldap_group_dn) DO UPDATE SET ldap_group_name = EXCLUDED.ldap_group_name, position_code = EXCLUDED.position_code, priority = EXCLUDED.priority, updated_at = NOW()
       RETURNING *`,
      [req.user!.tenantId, ldap_group_dn, ldap_group_name, position_code, priority || 100]
    );
    
    logger.info('LDAP position mapping saved', { ldapGroup: ldap_group_name, position: position_code, user: req.user!.email });
    res.json({ success: true, data: result, message: 'Pozisyon eşlemesi kaydedildi' });
  } catch (error) { next(error); }
});

/**
 * DELETE /ldap/position-mappings/:id
 * Delete position mapping
 */
router.delete('/position-mappings/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query('DELETE FROM ldap_position_mappings WHERE id = $1 AND tenant_id = $2 RETURNING id', [req.params.id, req.user!.tenantId]);
    if (result.rowCount === 0) throw new NotFoundError('Pozisyon eşlemesi');
    res.json({ success: true, message: 'Eşleme silindi' });
  } catch (error) { next(error); }
});

/**
 * GET /ldap/store-mappings
 * List store mappings
 */
router.get('/store-mappings', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mappings = await db.queryAll(
      `SELECT id, ldap_group_dn, ldap_group_name, store_id, store_name, grants_all_stores, created_at
       FROM ldap_store_mappings WHERE tenant_id = $1 ORDER BY ldap_group_name`,
      [req.user!.tenantId]
    );
    res.json({ success: true, data: mappings });
  } catch (error) { next(error); }
});

/**
 * POST /ldap/store-mappings
 * Add or update store mapping
 */
router.post('/store-mappings', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ldap_group_dn, ldap_group_name, store_id, store_name, grants_all_stores } = req.body;
    if (!ldap_group_dn) throw new ValidationError('LDAP grup DN zorunludur');
    if (!grants_all_stores && !store_id) throw new ValidationError('Mağaza ID veya tüm mağazalar seçeneği gereklidir');
    
    const result = await db.queryOne(
      `INSERT INTO ldap_store_mappings (tenant_id, ldap_group_dn, ldap_group_name, store_id, store_name, grants_all_stores)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, ldap_group_dn) DO UPDATE SET ldap_group_name = EXCLUDED.ldap_group_name, store_id = EXCLUDED.store_id, store_name = EXCLUDED.store_name, grants_all_stores = EXCLUDED.grants_all_stores, updated_at = NOW()
       RETURNING *`,
      [req.user!.tenantId, ldap_group_dn, ldap_group_name, store_id || '', store_name || '', grants_all_stores || false]
    );
    
    logger.info('LDAP store mapping saved', { ldapGroup: ldap_group_name, storeId: store_id, user: req.user!.email });
    res.json({ success: true, data: result, message: 'Mağaza eşlemesi kaydedildi' });
  } catch (error) { next(error); }
});

/**
 * DELETE /ldap/store-mappings/:id
 * Delete store mapping
 */
router.delete('/store-mappings/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query('DELETE FROM ldap_store_mappings WHERE id = $1 AND tenant_id = $2 RETURNING id', [req.params.id, req.user!.tenantId]);
    if (result.rowCount === 0) throw new NotFoundError('Mağaza eşlemesi');
    res.json({ success: true, message: 'Eşleme silindi' });
  } catch (error) { next(error); }
});

/**
 * POST /ldap/sync
 * Synchronize users from LDAP
 */
router.post('/sync', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const config = await db.queryOne('SELECT * FROM ldap_config WHERE tenant_id = $1', [req.user!.tenantId]);
    if (!config) throw new NotFoundError('LDAP yapılandırması');
    if (!config.is_active) throw new ValidationError('LDAP entegrasyonu aktif değil');
    
    const positionMappings = await db.queryAll('SELECT * FROM ldap_position_mappings WHERE tenant_id = $1 ORDER BY priority', [req.user!.tenantId]);
    const storeMappings = await db.queryAll('SELECT * FROM ldap_store_mappings WHERE tenant_id = $1', [req.user!.tenantId]);
    
    const syncLog = await db.queryOne(`INSERT INTO ldap_sync_logs (tenant_id, status) VALUES ($1, 'running') RETURNING id`, [req.user!.tenantId]);
    
    const stats = { found: 0, created: 0, updated: 0, deactivated: 0, skipped: 0, errors: [] as any[] };
    
    try {
      const password = decrypt(config.bind_password_encrypted);
      const { Client } = await import('ldapts');
      const client = new Client({ url: config.server_url });
      
      await client.bind(config.bind_dn, password);
      
      const searchBase = config.user_search_base || config.base_dn;
      const { searchEntries } = await client.search(searchBase, {
        scope: 'sub',
        filter: config.user_filter || '(&(objectClass=user)(mail=*))',
        attributes: ['sAMAccountName', 'mail', 'displayName', 'title', 'department', 'memberOf', 'distinguishedName'],
        paged: { pageSize: 500 }
      });
      
      await client.unbind();
      stats.found = searchEntries.length;
      
      const ldapUserDns: string[] = [];
      
      for (const entry of searchEntries) {
        try {
          const email = entry.mail as string;
          const name = (entry.displayName || entry.sAMAccountName) as string;
          const dn = entry.dn;
          const memberOf = (Array.isArray(entry.memberOf) ? entry.memberOf : [entry.memberOf].filter(Boolean)) as string[];
          
          if (!email) { stats.skipped++; continue; }
          ldapUserDns.push(dn);
          
          let positionCode = 'VIEWER';
          for (const mapping of positionMappings) {
            if (memberOf.some((g: string) => g.toLowerCase() === mapping.ldap_group_dn.toLowerCase())) {
              positionCode = mapping.position_code;
              break;
            }
          }
          
          const storeIds: string[] = [];
          for (const mapping of storeMappings) {
            if (memberOf.some((g: string) => g.toLowerCase() === mapping.ldap_group_dn.toLowerCase())) {
              if (mapping.grants_all_stores) { storeIds.push('*'); break; }
              else if (mapping.store_id) { storeIds.push(mapping.store_id); }
            }
          }
          
          const existingUser = await db.queryOne('SELECT id FROM users WHERE email = $1 AND tenant_id = $2', [email, req.user!.tenantId]);
          
          if (existingUser) {
            await db.query(
              `UPDATE users SET name = $1, ldap_dn = $2, ldap_synced = TRUE, ldap_last_sync_at = NOW(), ldap_groups = $3, is_active = TRUE, updated_at = NOW() WHERE id = $4`,
              [name, dn, JSON.stringify(memberOf), existingUser.id]
            );
            stats.updated++;
          } else {
            const newUser = await db.queryOne(
              `INSERT INTO users (tenant_id, email, name, password_hash, role, position_code, ldap_dn, ldap_synced, ldap_last_sync_at, ldap_groups, is_active)
               VALUES ($1, $2, $3, '', 'USER', $4, $5, TRUE, NOW(), $6, TRUE) RETURNING id`,
              [req.user!.tenantId, email, name, positionCode, dn, JSON.stringify(memberOf)]
            );
            
            for (const storeId of storeIds) {
              if (storeId === '*') continue;
              const storeMapping = storeMappings.find((m: any) => m.store_id === storeId);
              await db.query('INSERT INTO user_stores (user_id, store_id, store_name) VALUES ($1, $2, $3)', [newUser.id, storeId, storeMapping?.store_name || storeId]);
            }
            stats.created++;
          }
        } catch (userError: any) { stats.errors.push({ user: entry.mail, error: userError.message }); }
      }
      
      if (ldapUserDns.length > 0) {
        const deactivated = await db.query(
          `UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE tenant_id = $1 AND ldap_synced = TRUE AND ldap_dn IS NOT NULL AND ldap_dn NOT IN (${ldapUserDns.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING id`,
          [req.user!.tenantId, ...ldapUserDns]
        );
        stats.deactivated = deactivated.rowCount || 0;
      }
      
      await db.query(
        `UPDATE ldap_sync_logs SET status = $1, completed_at = NOW(), users_found = $2, users_created = $3, users_updated = $4, users_deactivated = $5, users_skipped = $6, errors = $7, summary = $8 WHERE id = $9`,
        [stats.errors.length > 0 ? 'partial' : 'success', stats.found, stats.created, stats.updated, stats.deactivated, stats.skipped, JSON.stringify(stats.errors), `${stats.found} kullanıcı bulundu, ${stats.created} oluşturuldu, ${stats.updated} güncellendi, ${stats.deactivated} deaktive edildi`, syncLog.id]
      );
      
      await db.query('UPDATE ldap_config SET last_sync_at = NOW() WHERE tenant_id = $1', [req.user!.tenantId]);
      
      logger.info('LDAP sync completed', { user: req.user!.email, found: stats.found, created: stats.created, updated: stats.updated });
      res.json({ success: true, message: `LDAP senkronizasyonu tamamlandı: ${stats.found} kullanıcı bulundu, ${stats.created} oluşturuldu, ${stats.updated} güncellendi`, data: stats });
      
    } catch (ldapError: any) {
      await db.query(`UPDATE ldap_sync_logs SET status = 'failed', completed_at = NOW(), errors = $1, summary = $2 WHERE id = $3`, [JSON.stringify([{ error: ldapError.message }]), `Senkronizasyon başarısız: ${ldapError.message}`, syncLog.id]);
      throw new AppError(`LDAP senkronizasyonu başarısız: ${ldapError.message}`, 500);
    }
  } catch (error) { next(error); }
});

/**
 * GET /ldap/sync-logs
 * Get LDAP sync history
 */
router.get('/sync-logs', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const logs = await db.queryAll(
      `SELECT id, started_at, completed_at, status, users_found, users_created, users_updated, users_deactivated, users_skipped, errors, summary
       FROM ldap_sync_logs WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [req.user!.tenantId, limit]
    );
    res.json({ success: true, data: logs });
  } catch (error) { next(error); }
});

export default router;
