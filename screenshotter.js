const { spawn } = require('child_process');
const puppeteer = require('puppeteer');

var stream = async function (options) {
  const browser = options.browser || (await puppeteer.launch());
  const page = options.page || (await browser.newPage());

  await options.prepare(browser, page);

  var ffmpegPath = options.ffmpeg || 'ffmpeg';
  var fps = options.fps || 30;
  var resolution = options.resolution || '1920x1080';
  var preset = options.preset || 'medium';
  var rate = options.rate || '2500k';
  var threads = options.threads || '2';

  var outUrl = options.output || 'rtmp://a.rtmp.youtube.com/live2/';
const ffmpegArgs = (fps) => [
  // IN
  '-f', 'image2pipe',
  '-use_wallclock_as_timestamps', '1',
  '-i', '-',
  '-f', 'lavfi', '-i', 'anullsrc',
  // OUT
  '-deinterlace',
  '-s', resolution,
  '-vsync', 'cfr',
  '-r', fps,
  '-g', (fps * 2),
  '-vcodec', 'libx264',
  '-x264opts', 'keyint=' + (fps * 2) + ':no-scenecut',
  '-preset', preset,
  '-b:v', rate,
  '-minrate', rate,
  '-maxrate', rate,
  '-bufsize', rate,
  '-pix_fmt', 'yuv420p',
  '-threads', threads,
  '-f', 'lavfi', '-acodec', 'libmp3lame', '-ar', '44100', '-b:a', '128k',
  '-f', 'flv',
];

  const args = ffmpegArgs(fps);

  var fullUrl = outUrl + options.key
  args.push(fullUrl);

  const ffmpeg = spawn(ffmpegPath, args);

  let screenshot = null;

  if (options.pipeOutput) {
    ffmpeg.stdout.pipe(process.stdout);
    ffmpeg.stderr.pipe(process.stderr);
  }

  while (true) {
    await options.render(browser, page);

    screenshot = await page.screenshot({ type: 'jpeg' });
    console.log("frame")

    await ffmpeg.stdin.write(screenshot);
  }
};


puppeteer.launch({
      defaultViewport: {
        width:1920,
        height:1080
      },
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"]
}).then(async browser => {
  const page = await browser.newPage();

  await page.goto('http://localhost:8080/', { waitUntil: 'networkidle2' });

  await stream({
    page: page,
    output: 'rtmp://ps-61488c636e2ff10001b54e93-rgaizldo.veset.cloud/live/', 
    key: 'fillera',
    fps: 25,
    prepare: function (browser, page) { },
    render: function (browser, page, frame) { }
  });

  await browser.close();
});