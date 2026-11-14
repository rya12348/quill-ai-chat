import http from 'node:http'
import net from 'node:net'

const listenPort = Number(process.env.RETRO_PORT || 5181)
const appPort = Number(process.env.APP_PORT || 5180)
const appHost = '127.0.0.1'

const server = http.createServer((req, res) => {
  const headers = { ...req.headers, host: `localhost:${appPort}` }
  const upstream = http.request(
    {
      host: appHost,
      port: appPort,
      path: req.url,
      method: req.method,
      headers,
    },
    (response) => {
      res.writeHead(response.statusCode || 502, response.headers)
      response.pipe(res)
    },
  )

  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('The editorial preview is not running on 5180.')
  })
  req.pipe(upstream)
})

server.on('upgrade', (req, socket, head) => {
  const upstream = net.connect(appPort, appHost, () => {
    const headers = { ...req.headers, host: `localhost:${appPort}` }
    upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n`)
    for (const [name, value] of Object.entries(headers)) {
      if (Array.isArray(value)) value.forEach((item) => upstream.write(`${name}: ${item}\r\n`))
      else if (value != null) upstream.write(`${name}: ${value}\r\n`)
    }
    upstream.write('\r\n')
    if (head?.length) upstream.write(head)
    socket.pipe(upstream).pipe(socket)
  })
  upstream.on('error', () => socket.destroy())
  socket.on('error', () => upstream.destroy())
})

server.listen(listenPort, '127.0.0.1', () => {
  console.log(`Retro host: http://127.0.0.1:${listenPort}/ -> http://${appHost}:${appPort}/`)
})
