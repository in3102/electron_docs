const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const cheerio = require('cheerio')
const hljs = require('highlight.js')
var md = require('markdown-it')({
  html: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(lang, str).value
      } catch (__) {}
    }
    return ''
  }
})

let indexes = []
const inputPath = path.join('docs', 'content', 'zh-CN', 'docs')
const outputPath = path.join('public', 'docs')
if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath)
}
// clone 中文文档
const docsPath = path.resolve(__dirname, 'docs')
if (!fs.existsSync(docsPath)) {
  console.log('cloning https://github.com/electron/i18n.git')
  execSync('git clone --depth=1 https://github.com/electron/i18n.git ' + docsPath)
}

generate()

// 写入合索引文件
const indexesPath = path.join('public', 'indexes.json')
if (fs.existsSync(indexesPath)) fs.unlinkSync(indexesPath)
fs.writeFileSync(indexesPath, JSON.stringify(indexes))

console.log('\n处理完毕 ☕️')

function generate (dir = '') {
  const dirArr = fs.readdirSync(path.join(inputPath, dir), { encoding: 'utf-8', withFileTypes: true })
  dirArr.forEach(element => {
    const saveDir = path.join(outputPath, dir)
    // console.log(dir, element)
    if (element.isDirectory()) {
      const newDir = path.join(saveDir, element.name)
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir)
      }
      return generate(path.join(dir, element.name))
    }
    const file = path.parse(element.name)
    if (file.ext === '.md') {
      const html = generateHtml(path.join(inputPath, dir, element.name))
      fs.writeFileSync(path.join(saveDir, element.name.replace('.md', '.html')), html)
    }
  })
}

function generateHtml (dir) {
  const content = fs.readFileSync(dir, { encoding: 'utf-8' })
  const html = `<!DOCTYPE html><html lang="zh_CN"><head><meta charset="UTF-8"><title></title><link rel="stylesheet" href="` + getCssPath(dir) + `" /></head>
    <body><div class="markdown-body">${md.render(content)}</div></body></html>`

  const $ = cheerio.load(html)
  $('a').each((i, item) => {
    let href = $(item).attr('href')
    if (!href) {
      return
    }
    $(item).attr('href', href.replace('.md', '.html'))
  })
  const h = ['h1', 'h2', 'h3', 'h4']
  $(h.join(',')).each((i, item) => {
    const $this = $(item)
    const text = $this.text()
    $this.attr('id', text)

    const getDesc = function (node, desc) {
      // 碰到 h1-h4 标签则返回
      if (!node[0] || h.includes(node[0].name)) {
        return desc
      }
      if (['p', 'blockquote'].includes(node[0].name) && node.text() !== '返回:') {
        desc += node.text()
      }
      if (desc.length > 50) {
        return desc.substr(0, 50)
      }
      return getDesc($(node).next(), desc)
    }
    let desc = getDesc($this.next(), '') || text
    indexes.push({
      t: text,
      d: desc,
      p: path.join('docs', dir.replace(inputPath, '').replace('.md', '.html')) + '#' + text
    })
  })
  return $.html()
}

function getCssPath (dir) {
  let def = '../css/doc.css'
  const s = dir.replace(inputPath, '').split(path.sep)
  for (let i = 2; i < s.length; i++) {
    def = '../' + def
  }
  return def
}
