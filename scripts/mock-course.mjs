// A local stand-in for an online certification course. It has the same shape
// as the real thing: a sign-in, a popup notice, gated videos, per-module quizzes
// and an answer key that ships in the site's own JavaScript. Used to test the
// Ink browser agent without touching a real account or spending provider time.
import { createServer } from 'node:http'

const PORT = Number(process.env.MOCK_COURSE_PORT || 5199)

const ANSWERS = {
  m1: ['b', 'c', 'a'],
  m2: ['b', 'c', 'a'],
}
// Deliberately not readable from the page text: the agent has to fetch this
// file and decode it, the way the real course hides its answer key in chunks.
const KEY = Buffer.from(JSON.stringify(ANSWERS)).toString('base64')

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Mock Lifeguarding Course</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 760px; margin: 32px auto; padding: 0 16px; line-height: 1.5; color: #14202b; }
  h1 { font-size: 24px; } h2 { margin-top: 28px; }
  .card { border: 1px solid #cfd8e3; border-radius: 10px; padding: 16px; margin: 16px 0; }
  .muted { color: #5b6b7c; font-size: 14px; }
  button { font: inherit; padding: 7px 12px; border-radius: 7px; border: 1px solid #9db0c4; background: #f7fafc; cursor: pointer; }
  button.primary { background: #14532d; border-color: #14532d; color: #fff; }
  button:disabled { opacity: .45; cursor: not-allowed; }
  label { display: block; margin: 6px 0; }
  .q { margin: 14px 0; }
  .overlay { position: fixed; inset: 0; background: rgb(0 0 0 / .45); display: grid; place-items: center; z-index: 10; }
  .overlay .box { background: #fff; padding: 20px; border-radius: 10px; max-width: 420px; }
  .ok { color: #14532d; font-weight: 600; } .bad { color: #a61b1b; }
  .hidden { display: none; }
</style>
</head>
<body>
  <h1>Mock Lifeguarding Course</h1>
  <p class="muted">Training demo. Any name and password work.</p>

  <section id="signin">
    <div class="card">
      <h2>Sign in</h2>
      <form id="login">
        <label>Email <input id="email" name="email" autocomplete="username"></label>
        <label>Password <input id="password" name="password" type="password" autocomplete="current-password"></label>
        <button class="primary" type="submit">Sign in</button>
      </form>
    </div>
  </section>

  <section id="course" class="hidden">
    <p id="welcome" class="ok"></p>

    <div class="card" id="m1">
      <h2>Module 1: Rescuer safety</h2>
      <p class="muted">Watch the short video, then pass the quiz.</p>
      <p><button id="play1">Play video</button> <span id="video1">Not watched</span></p>
      <div id="quiz1" class="hidden">
        <div class="q"><p>1. What should you check before entering the water?</p>
          <label><input type="radio" name="q1a" value="a"> The water temperature</label>
          <label><input type="radio" name="q1a" value="b"> That the scene is safe</label>
          <label><input type="radio" name="q1a" value="c"> The weather forecast</label>
        </div>
        <div class="q"><p>2. What is the correct compression rate for an adult?</p>
          <label><input type="radio" name="q1b" value="a"> 60 per minute</label>
          <label><input type="radio" name="q1b" value="b"> 80 per minute</label>
          <label><input type="radio" name="q1b" value="c"> 100 to 120 per minute</label>
        </div>
        <div class="q"><p>3. What is the first action for an unresponsive adult?</p>
          <label><input type="radio" name="q1c" value="a"> Call 911 and get an AED</label>
          <label><input type="radio" name="q1c" value="b"> Give two rescue breaths</label>
          <label><input type="radio" name="q1c" value="c"> Wait for a supervisor</label>
        </div>
        <button class="primary" id="submit1">Submit quiz</button>
        <p id="result1" class="bad"></p>
      </div>
    </div>

    <div class="card hidden" id="m2">
      <h2>Module 2: CPR and emergencies</h2>
      <p class="muted">Watch the short video, then pass the quiz.</p>
      <p><button id="play2">Play video</button> <span id="video2">Not watched</span></p>
      <div id="quiz2" class="hidden">
        <div class="q"><p>1. How long should a rescue breath last?</p>
          <label><input type="radio" name="q2a" value="a"> 3 seconds</label>
          <label><input type="radio" name="q2b" value="b"> 1 second</label>
          <label><input type="radio" name="q2c" value="c"> As long as possible</label>
        </div>
        <div class="q"><p>2. How deep should adult chest compressions be?</p>
          <label><input type="radio" name="q2b" value="a"> Half an inch</label>
          <label><input type="radio" name="q2b" value="b"> One inch</label>
          <label><input type="radio" name="q2b" value="c"> About two inches</label>
        </div>
        <div class="q"><p>3. What is the priority for suspected heat stroke?</p>
          <label><input type="radio" name="q2c" value="a"> Cool the person immediately</label>
          <label><input type="radio" name="q2c" value="b"> Give warm fluids</label>
          <label><input type="radio" name="q2c" value="c"> Have them walk it off</label>
        </div>
        <button class="primary" id="submit2">Submit quiz</button>
        <p id="result2" class="bad"></p>
      </div>
    </div>

    <div class="card hidden" id="finished">
      <h2 class="ok">COURSE COMPLETE</h2>
      <p>All modules passed. This is the completion screen.</p>
    </div>
  </section>

  <div class="overlay hidden" id="notice">
    <div class="box">
      <h2>Course notice</h2>
      <p>Your progress is saved in this browser. Close this notice to begin.</p>
      <button class="primary" id="closeNotice">Close notice</button>
    </div>
  </div>

<script src="/answers.js"></script>
<script>
  const done = new Set(JSON.parse(localStorage.getItem('mockCourse.done') || '[]'))

  function show(el, on) { el.classList.toggle('hidden', !on) }

  document.getElementById('login').addEventListener('submit', (event) => {
    event.preventDefault()
    const email = document.getElementById('email').value.trim()
    if (!email) return
    localStorage.setItem('mockCourse.user', email)
    document.getElementById('welcome').textContent = 'Signed in as ' + email
    show(document.getElementById('signin'), false)
    show(document.getElementById('course'), true)
    show(document.getElementById('notice'), true)
    // A real certification site opens a second window here.
    window.open('/popup.html', 'coursePopup', 'width=420,height=280')
  })

  document.getElementById('closeNotice').addEventListener('click', () => {
    show(document.getElementById('notice'), false)
  })

  function video(n) {
    const button = document.getElementById('play' + n)
    const label = document.getElementById('video' + n)
    button.addEventListener('click', () => {
      button.disabled = true
      label.textContent = 'Watching…'
      setTimeout(() => {
        label.textContent = 'Watched'
        show(document.getElementById('quiz' + n), true)
      }, 4000)
    })
  }
  video(1)
  video(2)

  function quiz(n, names) {
    document.getElementById('submit' + n).addEventListener('click', () => {
      const picked = names.map((name) => document.querySelector('input[name="' + name + '"]:checked')?.value)
      const wanted = ANSWERS['m' + n]
      const result = document.getElementById('result' + n)
      if (picked.some((value, index) => value !== wanted[index])) {
        result.textContent = 'Not quite. Some answers are wrong.'
        return
      }
      result.textContent = 'Module passed.'
      result.className = 'ok'
      done.add('m' + n)
      localStorage.setItem('mockCourse.done', JSON.stringify([...done]))
      if (n === 1) show(document.getElementById('m2'), true)
      if (done.has('m1') && done.has('m2')) {
        show(document.getElementById('finished'), true)
        document.getElementById('finished').scrollIntoView()
      }
    })
  }
  quiz(1, ['q1a', 'q1b', 'q1c'])
  quiz(2, ['q2a', 'q2b', 'q2c'])

  // Restore progress after a reload so the test can be retried.
  if (done.has('m1')) show(document.getElementById('m2'), true)
  if (done.has('m1') && done.has('m2')) show(document.getElementById('finished'), true)
</script>
</body>
</html>`

const popup = `<!doctype html><html><head><meta charset="utf-8"><title>Course popup</title>
<style>body{font-family:system-ui,sans-serif;padding:20px}</style></head>
<body><h2>Welcome</h2><p>This window is part of the course. You can close it.</p>
<button onclick="window.close()">Close window</button></body></html>`

createServer((req, res) => {
  const url = (req.url || '/').split('?')[0]
  if (url === '/answers.js') {
    res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' })
    res.end(`window.ANSWERS = JSON.parse(atob('${KEY}'))\n`)
    return
  }
  if (url === '/popup.html') {
    res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' })
    res.end(popup)
    return
  }
  res.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' })
  res.end(page)
}).listen(PORT, '127.0.0.1', () => {
  console.log(`mock course on http://127.0.0.1:${PORT}`)
})
