-- ============================================
-- GÜÇLER AYRILIĞI - KATEGORİ YÖNETİMİ TRIGGERs
-- Production için zorunlu
-- ============================================

-- Kategori ataması yapıldığında kullanıcıyı güncelle
CREATE OR REPLACE FUNCTION public.update_user_category_access() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    -- INSERT: Kullanıcıya kategori atandı, artık tüm kategorileri göremez
    IF TG_OP = 'INSERT' THEN
        UPDATE users SET can_see_all_categories = false WHERE id = NEW.user_id;
        RETURN NEW;
    END IF;
    
    -- DELETE: Kategori kaldırıldı, başka kategorisi kalmadıysa tüm kategorileri görebilir
    IF TG_OP = 'DELETE' THEN
        -- Kullanıcının başka kategorisi var mı kontrol et
        IF NOT EXISTS (SELECT 1 FROM user_report_categories WHERE user_id = OLD.user_id) THEN
            UPDATE users SET can_see_all_categories = true WHERE id = OLD.user_id;
        END IF;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$;

-- Trigger: Kategori ataması INSERT
DROP TRIGGER IF EXISTS trg_user_category_insert ON public.user_report_categories;
CREATE TRIGGER trg_user_category_insert 
    AFTER INSERT ON public.user_report_categories 
    FOR EACH ROW EXECUTE FUNCTION public.update_user_category_access();

-- Trigger: Kategori ataması DELETE
DROP TRIGGER IF EXISTS trg_user_category_delete ON public.user_report_categories;
CREATE TRIGGER trg_user_category_delete 
    AFTER DELETE ON public.user_report_categories 
    FOR EACH ROW EXECUTE FUNCTION public.update_user_category_access();

-- Admin kullanıcısını güncelle (ADMIN her zaman tüm kategorileri görür)
UPDATE users SET can_see_all_categories = true WHERE role = 'ADMIN';

-- Mevcut kategori atamalarına göre kullanıcıları güncelle
UPDATE users SET can_see_all_categories = false 
WHERE id IN (SELECT DISTINCT user_id FROM user_report_categories);

-- Doğrulama
SELECT 
    u.email, 
    u.role, 
    u.can_see_all_categories,
    COUNT(urc.id) as category_count
FROM users u
LEFT JOIN user_report_categories urc ON u.id = urc.user_id
GROUP BY u.id, u.email, u.role, u.can_see_all_categories
HAVING COUNT(urc.id) > 0 OR u.role = 'ADMIN'
ORDER BY u.role, u.email;
