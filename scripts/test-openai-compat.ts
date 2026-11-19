import OpenAI from 'openai'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env') })

const apiKey = process.env.GEMINI_API_KEY
console.log('Testing key ending with:', apiKey?.slice(-6))

async function run() {
  const openai = new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  })

  try {
    const res = await openai.chat.completions.create({
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user', content: 'Say hello in one word' }],
    })
    console.log('Response choice:', res.choices[0]?.message?.content)
  } catch (err: any) {
    console.error('Error status:', err.status)
    console.error('Error message:', err.message)
    console.error('Error body:', err.error)
  }
}

run()
