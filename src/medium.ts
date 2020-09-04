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

  height: number = 1000;
  width: number = 800;

  async start() {
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
    const medium = (await browser.pages())[0];
    await medium.goto('https://medium.com/me/list/queue');
    await medium.waitFor(5000);
    await this.scrollToEnd(medium);
    await medium.waitFor(2000);
    const items = await this.extractItems(medium);
    const https = items.map(item =>
      item.href.startsWith('https')
        ? item
        : { ...item, href: `https://medium.com${item.href}` },
    );
    // const link = https[0];
    for (const link of https) {
      const page = await browser.newPage();
      await page.goto(link.href);
      console.log(`Page loaded: ${link.href}`);
      await page.waitFor(5000);
      console.log(`Taking screenshots`);
      const images = await this.prepareScreenshots(page);
      console.log('Printing PDF');
      await this.generatePDF(images, link.title, link.author);
      await page.waitFor(1000);
      await page.close();
    }
    await browser.close();
    return https;
  }

  async extractItems(page: Page): Promise<Article[]> {
    const articles = await page.$$('div.ex.dw');
    const links: Article[] = [];
    for (const article of articles) {
      const link = await article.$('a');
      const authorDiv = await article.$('h4');
      const author = await page.evaluate(div => div.innerHTML, authorDiv);
      const href = await page.evaluate(div => {
        return div.getAttribute('href');
      }, link);
      const titleDiv = await link.$('h2');
      const title = await page.evaluate(h2 => h2.innerHTML, titleDiv);
      links.push({ title, href, author });
    }
    return links;
  }

  async scrollToEnd(page) {
    await page.evaluate(async () => {
      await new Promise((resolve, reject) => {
        var totalHeight = 0;
        var distance = 900;
        var timer = setInterval(async () => {
          var scrollHeight = document.body.scrollHeight;
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
    try {
      const path = `./screenshots/article_${new Date().getTime()}.png`;
      await element.screenshot({
        path,
      });
      images.push({
        path,
        height: totalHeight,
      });
    } catch (ex) {}
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
      const articles = await fs.promises.readdir('./articles');
      const files = articles.map(article => `./articles/${article}`);
      const copies = articles.map(
        article => `/Volumes/Kindle/documents/Articles/${article}`,
      );
      for (let i = 0; i < files.length; i++) {
        fs.createReadStream(files[i]).pipe(fs.createWriteStream(copies[i]));
      }
    }
  }
}
