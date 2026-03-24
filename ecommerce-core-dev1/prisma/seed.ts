import { PrismaClient, ClientPlan } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const client = await prisma.client.create({
    data: {
      name: 'Test Client',
      shopify_domain: 'test-store.myshopify.com',
      plan: ClientPlan.PRO,
    },
  })

  console.log('Created test client:', client.id)

  await prisma.promptTemplate.create({
    data: {
      name: 'product-description',
      version: 1,
      content: `Create a compelling product description for {title} in the {category} category.\n\nAttributes: {attributes_json}\n\nReturn ONLY a JSON object with this exact shape: {"description": "...", "meta_title": "...", "meta_description": "..."}`,
      variables: ['title', 'category', 'attributes_json'],
    }
  })

  await prisma.promptTemplate.create({
    data: {
      name: 'catalog-enrichment',
      version: 1,
      content: `Analyze this raw product row and enrich it.\n\nRaw Data: {raw_row}\n\nReturn ONLY a JSON object with this exact shape: {"title": "...", "category": "...", "attributes": {"key": "value"}, "suggested_tags": ["tag1", "tag2"], "quality_score": 0.9}`,
      variables: ['raw_row'],
    }
  })

  await prisma.promptTemplate.create({
    data: {
      name: 'return-classification',
      version: 1,
      content: `Analyze this return reason and classify it.\n\nReason: {reason_text}\nProduct ID: {product_id}\nOrder ID: {order_id}\n\nReturn EXACTLY this JSON shape: {"action": "REFUND" | "EXCHANGE" | "REJECT" | "REVIEW", "confidence": 0.95, "reason": "..."}`,
      variables: ['reason_text', 'product_id', 'order_id'],
    }
  })

  console.log('Created prompt templates')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
