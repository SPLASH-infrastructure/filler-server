const puppeteer = require('puppeteer');
const { join } = require('path');
const { spawn } = require('child_process');
const fs = require('fs').promises;



class PuppeteerRTMP {
    async init(
        page, 
        options = {}
) {
    this.page = page;
    this.client = await this.page.target().createCDPSession();
    this.canScreenshot = true;
    this.ffmpegPath = options.ffmpeg || 'ffmpeg';
    this.fps = options.fps || 25;
    this.resolution = options.resolution || '1920x1080';
    this.preset = options.preset || 'ultrafast';
    this.rate = options.rate || '2500k';
    this.threads = options.threads || '0';
    this.outUrl = options.output;

    const args = this.ffmpegArgs(this.fps)
    args.push(this.outUrl)
    this.ffmpeg = spawn(this.ffmpegPath, args)

  	if (options.pipeOutput) {
  		this.ffmpeg.stdout.pipe(process.stdout);
  		this.ffmpeg.stderr.pipe(process.stderr);
  	}

    var ffmpeg = this.ffmpeg;
    this.client.on('Page.screencastFrame', async (frameObject) => {
        if (this.canScreenshot) {
          let buff = new Buffer(frameObject.data, 'base64')
        	await ffmpeg.stdin.write(buff);
            try {
              console.log("frame")
                await this.client.send('Page.screencastFrameAck', { sessionId: frameObject.sessionId});
            } catch(e) {
                this.canScreenshot = false;
            }
        }
    });
    }
    async start(options = {}) {
        const startOptions = {
            format: 'jpeg',
            quality: 100,
            maxWidth: 1920,
            maxHeight: 1080,
            everyNthFrame: 1,
            ...options
        };
        return this.client.send('Page.startScreencast', startOptions);
    }

    async stop() {
      // windows:
      this.canScreenshot = false;
      console.log("killing pid " + this.ffmpeg.pid);
      this.ffmpeg.kill('SIGINT');
      console.log("killed");
        return this.client.send('Page.stopScreencast');
    }

    ffmpegArgs(fps) { return [
		  // IN
      '-y',
		  '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
		  '-use_wallclock_as_timestamps', '1',
		  '-i', '-', 
		  '-f', 'lavfi', '-i', 'anullsrc',
		  // OUT
		  '-deinterlace',
		  '-s', this.resolution,
		  '-vsync', 'cfr',
		  '-r', this.fps,
		  '-g', (this.fps * 2),
		  '-vcodec', 'libx264',
      '-vf', "fps=25",
		  '-x264opts', 'keyint=' + (this.fps * 2) + ':no-scenecut',
		  '-preset', this.preset,
		  '-b:v', this.rate,
		  '-minrate', this.rate,
		  '-maxrate', this.rate,
		  '-bufsize', this.rate,
		  '-pix_fmt', 'yuv420p',
		  '-threads', this.threads,
		  '-f', 'lavfi', '-acodec', 'libmp3lame', '-ar', '44100', '-b:a', '128k',
		  '-f', 'flv',
		];
	}
}


function delay(time) {
   return new Promise(function(resolve) { 
       setTimeout(resolve, time)
   });
}

(async () => {
  const browser = await puppeteer.launch({
      defaultViewport: {
        width:1920,
        height:1080
      }});
  const page = await browser.newPage();
  const screenshots = new PuppeteerRTMP();
  await page.goto('http://localhost:8080/');
  await screenshots.init(page, {output: "rtmp://ps-61488c636e2ff10001b54e93-rgaizldo.veset.cloud/live/fillera", pipeOutput: true});
  await screenshots.start();
})();