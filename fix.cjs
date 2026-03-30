const fs = require('fs')
const path = require('path')

const manifestPath = path.join(__dirname, 'dist', 'manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

const baseResources = [
  'index.html',
  'assets/*',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'favicon-48x48.png',
  'favicon-128x128.png',
]

const matches = ['https://*.bilibili.com/*']

const normalized = []
const seen = new Set()

for (const item of manifest.web_accessible_resources ?? []) {
  const resources = [...new Set([...(item.resources ?? []), ...baseResources])]
  const key = JSON.stringify({
    matches,
    resources: [...resources].sort(),
  })

  if (seen.has(key)) {
    continue
  }

  seen.add(key)
  normalized.push({
    matches,
    resources,
    use_dynamic_url: false,
  })
}

if (normalized.length === 0) {
  normalized.push({
    matches,
    resources: baseResources,
    use_dynamic_url: false,
  })
}

manifest.web_accessible_resources = normalized

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
