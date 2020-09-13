import { launch, Page, Browser, ElementHandle } from 'puppeteer';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
export interface Article {
  title: string;
  author: string;
  href: string;
}
export interface Image {
  path: string;
  height: number;
}

export class MediumScraper {
  browser: Browser;

  height = 1000;
  width = 800;

  constructor() {
    if (fs.existsSync('/Volumes/Kindle/documents')) {
      if (!fs.existsSync('/Volumes/Kindle/documents/Articles')) {
        fs.mkdirSync('/Volumes/Kindle/documents/Articles');
      }
    }

    if (!fs.existsSync('./chromium-data')) {
      fs.mkdirSync('./chromium-data');
    }
    if (!fs.existsSync('./screenshots')) {
      fs.mkdirSync('./screenshots');
    }
    if (!fs.existsSync('./articles')) {
      fs.mkdirSync('./articles');
    }
    if (!fs.existsSync('./articles_old')) {
      fs.mkdirSync('./articles_old');
    }
  }

  async runBrowser() {
    launch({
      headless: false,
      defaultViewport: {
        width: this.width,
        height: this.height,
      },
      executablePath: '/Applications/Chromium.app/Contents/MacOS/Chromium',
      userDataDir: './chromium-data',
      args: ['--hide-scrollbars'],
    });
  }

  async start() {
    await this.cleanArticlesFolder();
    const browser = await launch({
      headless: false,
      defaultViewport: {
        width: this.width,
        height: this.height,
      },
      executablePath: '/Applications/Chromium.app/Contents/MacOS/Chromium',
      userDataDir: './chromium-data',
      args: ['--hide-scrollbars'],
    });
    this.browser = browser;
    const medium = (await browser.pages())[0];
    await medium.goto('https://medium.com/me/list/queue');
    await medium.waitFor(5000);
    await this.scrollToEnd(medium);
    await medium.waitFor(2000);
    const items = await this.extractItems(medium);
    await browser.close();
    await this.copyFilesToKindle();
    console.log('Done');
    return items;
  }

  async cleanArticlesFolder() {
    const articles = await fs.promises.readdir('./articles');
    const files = articles.map(article => `./articles/${article}`);
    const copies = articles.map(article => `./articles_old/${article}`);
    for (let i = 0; i < files.length; i++) {
      const file = await fs.promises.readFile(files[i]);
      await fs.promises.writeFile(copies[i], file);
      await fs.promises.unlink(files[i]);
    }
  }

  async parsePage(article: Article) {
    const page = await this.browser.newPage();
    await page.goto(article.href);
    console.log(`Page loaded: ${article.title}`);
    await page.waitFor(5000);
    await this.scrollToEnd(page);
    console.log(`Taking screenshots for: ${article.title}`);
    const images = await this.prepareScreenshots(page);
    console.log(`Generating PDF: ${article.title}`);
    await this.generatePDF(images, article.title, article.author);
    await page.waitFor(1000);
    await page.close();
  }

  async extractItems(page: Page) {
    await page.waitFor(500);
    const identifier = 'div.ey';
    let article = await page.$(identifier);
    if (!article) {
      return;
    }
    const link = await article.$('a');
    const authorDiv = await article.$('h4');
    const author = await page.evaluate(div => div.innerHTML, authorDiv);
    const relative = await page.evaluate(div => {
      return div.getAttribute('href');
    }, link);
    const href = relative.startsWith('https')
      ? relative
      : `https://medium.com${relative}`;
    const titleDiv = await link.$('h2');
    const title = await page.evaluate(h2 => h2.innerHTML, titleDiv);
    await this.parsePage({ title, href, author });
    article = await page.$(identifier);
    const h4 = await article.$$('h4');
    for (const div of h4) {
      const archive = await page.evaluate(
        (div: HTMLElement) => div.innerText.includes('Archive'),
        div,
      );
      if (archive) {
        console.log(`Archiving: ${title}`);
        await div.click();
      }
    }
    page.waitFor(3000);
    const newArticle = await page.$(identifier);
    if (newArticle) {
      await this.extractItems(page);
    }
  }

  async scrollToEnd(page) {
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0;
        const distance = 900;
        const timer = setInterval(async () => {
          let scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          scrollHeight = document.body.scrollHeight;
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 500);
      });
    });
  }

  async screenshotChildElements(
    page: Page,
    element: ElementHandle<Element>,
    images: Image[],
  ) {
    const totalHeight = await page.evaluate(
      (div: HTMLElement) => div.clientHeight,
      element,
    );
    const totalWidth = await page.evaluate(
      (div: HTMLElement) => div.clientWidth,
      element,
    );
    if (totalHeight === 0 || totalWidth < 100) {
      return;
    }
    if (totalHeight > 1000) {
      const listHandle = await page.evaluateHandle(
        div => div.children,
        element,
      );
      const properties = await listHandle.getProperties();
      const children = [];
      for (const property of properties.values()) {
        const element = property.asElement();
        if (element) children.push(element);
      }
      for (const child of children) {
        await this.screenshotChildElements(page, child, images);
      }
      return;
    }
    const path = `./screenshots/article_${new Date().getTime()}.png`;
    await element.screenshot({
      path,
    });
    images.push({
      path,
      height: totalHeight,
    });
  }

  async prepareScreenshots(page: Page): Promise<Image[]> {
    const article = await page.$('article');
    const images: Image[] = [];
    await this.screenshotChildElements(page, article, images);
    return images;
  }

  async generatePDF(images: Image[], title, author) {
    const doc = new PDFDocument({
      margins: { top: 0, left: 0, right: 0, bottom: 0 },
      size: [this.width, this.height],
    });
    const filename = title.replace(/[/\\?%*:|"<>]/g, '-');

    doc.pipe(fs.createWriteStream(`./articles/${filename}.pdf`));
    doc.image(images[0].path, {
      fit: [this.width, images[0].height],
      align: 'center',
    });
    let total = images[0].height;
    for (let i = 1; i < images.length; i++) {
      const image = images[i];
      total += image.height;
      if (total >= this.height) {
        doc.addPage({
          margins: { top: 0, left: 0, right: 0, bottom: 0 },
          size: [this.width, this.height],
        });
        total = image.height;
      }
      doc.image(image.path, {
        fit: [this.width, image.height],
        align: 'center',
      });
    }
    doc.info.Author = author;
    doc.end();
    images.forEach(file => {
      fs.unlinkSync(file.path);
    });
  }

  async copyFilesToKindle() {
    if (fs.existsSync('/Volumes/Kindle/documents/Articles')) {
      console.log('Copying files to Kindle');
      const articles = await fs.promises.readdir('./articles');
      const files = articles.map(article => `./articles/${article}`);
      const copies = articles.map(
        article => `/Volumes/Kindle/documents/Articles/${article}`,
      );
      for (let i = 0; i < files.length; i++) {
        await new Promise(resolve => {
          fs.createReadStream(files[i])
            .pipe(fs.createWriteStream(copies[i]))
            .on('finish', () => resolve());
        });
      }
    } else {
      console.log('Kindle not connected');
    }
  }
}
