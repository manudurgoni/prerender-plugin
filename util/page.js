const FS = require('fs')
const Path = require('path')
const mkdirp = require('mkdirp')

function captureAndSave (page, folder, file, callback) {
  page
    .content()
    .then(content => {
      mkdirp(folder, () => {
        FS.writeFileSync(file, content)
      })

      page
        .close()
        .catch(callback)
        .then(callback)
    })
    .catch(err => {
      callback(err)
    })
}

module.exports = {
  process: async(route, options, callback) => {
    const folder = Path.join(options.target, route)
    const file = Path.join(folder, 'index.html')
    const url = `${options.url}${route}`

    try {
      const page = await options.browser.newPage()
      await page.setRequestInterception(true)

      page.on('request', req => {
        if (
          req.resourceType === 'stylesheet' ||
          req.resourceType === 'font' ||
          req.resourceType === 'image'
        ) {
          req.abort()
        } else {
          req.continue()
        }
      })

      await page.goto(url)

      if (!options.capture) {
        captureAndSave(page, folder, file, callback)
      }

      if (options.capture.delay) {
        setTimeout(() => {
          captureAndSave(page, folder, file, callback)
        }, options.capture.delay)
      } else if (options.capture.event) {
        // TODO: run script in page context
        captureAndSave(page, folder, file, callback)
      } else if (options.capture.selector) {
        const retries = 7
        let tries = 0

        const check = setInterval(() => {
          if (tries < retries) {
            page.$(options.capture.selector).then(sel => {
              if (sel) {
                clearInterval(check)
                captureAndSave(page, folder, file, callback)
              }
            })

            tries += 1
          } else {
            clearInterval(check)
            throw new Error('Cannot find the specified selector in page.')
          }
        }, 250)
      }
    } catch (err) {
      throw err
    }
  }
}