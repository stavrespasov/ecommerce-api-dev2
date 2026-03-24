import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface TemplateCache {
  content: string
  expiresAt: number
}

const cache: Record<string, TemplateCache> = {}

export async function loadTemplate(name: string): Promise<string> {
  const now = Date.now()
  if (cache[name] && cache[name].expiresAt > now) {
    return cache[name].content
  }

  const template = await prisma.promptTemplate.findFirst({
    where: { name, is_active: true },
    orderBy: { version: 'desc' }
  })

  if (!template) {
    throw new Error(`Template not found: ${name}`)
  }

  cache[name] = {
    content: template.content,
    expiresAt: now + 60 * 1000 // 1 minute
  }

  return template.content
}

export function interpolate(template: string, vars: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{${key}}`, 'g'), value)
  }
  return result
}
