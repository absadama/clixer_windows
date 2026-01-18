/**
 * MSW Server Setup
 * Node.js ortamında (test) çalışan mock server
 */

import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// MSW server'ı oluştur
export const server = setupServer(...handlers)
