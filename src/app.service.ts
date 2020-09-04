import { Injectable, Scope } from '@nestjs/common';
import { launch, Page, Browser } from 'puppeteer';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';

export interface Article {
  title: string;
  author: string;
  href: string;
}

@Injectable({ scope: Scope.REQUEST })
export class AppService {
  browser: Browser;

  height: number = 1000;
  width: number = 800;
  // zoom: number = 1.4;

  async login(medium: Page) {
    await medium.goto('https://medium.com/me/list/queue');
    // (await medium.waitForSelector('button.bh')).click();
    let buttons = await medium.$$('button');
    for (const button of buttons) {
      const close = await medium.evaluate((div: HTMLElement) => {
        return div.innerHTML.includes('svg');
      }, button);
      const contin = await medium.evaluate((div: HTMLElement) => {
        return div.innerHTML.includes('Continue');
      }, button);
      if (close) {
        await button.click();
      }
      if (contin) {
        await button.click();
      }
    }
    await medium.waitFor(2000);
    let links = await medium.$$('a');
    for (const link of links) {
      const signing = await medium.evaluate((div: HTMLElement) => {
        return div.innerHTML.includes('Sign in');
      }, link);
      if (signing) {
        await link.click();
      }
    }
    await medium.waitFor(3000);
    links = await medium.$$('a');
    for (const link of links) {
      const signing = await medium.evaluate((div: HTMLElement) => {
        return div.innerHTML.includes('Sign in with Google');
      }, link);
      if (signing) {
        await link.click();
        break;
      }
    }
    await medium.waitFor(3000);
    console.log('in Google');
    const email = await medium.$('input[type="email"]');
    await email.type('hussain.alaidarous');
    buttons = await medium.$$('button');
    for (const button of buttons) {
      const next = await medium.evaluate((div: HTMLElement) => {
        return div.innerHTML.includes('التالي');
      }, button);
      if (next) {
        await button.click();
        break;
      }
    }
    console.log('Done with email');
    await medium.waitFor(2000);
    const password = await medium.$('input[type="password"]');
    await password.type(process.env.GOOGLE_APP_PASSWORD);
    buttons = await medium.$$('button');
    for (const button of buttons) {
      const next = await medium.evaluate((div: HTMLElement) => {
        return div.innerHTML.includes('التالي');
      }, button);
      if (next) {
        await button.click();
        break;
      }
    }
    await medium.screenshot({
      path: '../screenshots/password.png',
    });
  }

  async start() {
    const browser = await launch({
      headless: false,
      defaultViewport: {
        width: this.width,
        height: this.height,
        // deviceScaleFactor: this.zoom,
      },
      executablePath: '/Applications/Chromium.app/Contents/MacOS/Chromium',
      userDataDir: '../chromium-data',
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
    for (const link of https) {
      const page = await browser.newPage();
      await page.goto(link.href);
      console.log(`Page loaded: ${link.href}`);
      await page.waitFor(5000);
      console.log(`Taking screenshots`);
      const pages = await this.prepareScreenshots(page);
      console.log('Printing PDF');
      await this.generatePDF(pages, link.title, link.author);
      await page.waitFor(1000);
      await page.close();
    }
    await browser.close();
    return https;
  }

  async extractItems(page: Page): Promise<Article[]> {
    const articles = await page.$$('div.ew');
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

  async prepareScreenshots(page: Page): Promise<number> {
    const section = (await page.$$('section'))[1];
    let totalHeight = await page.evaluate((div: HTMLElement) => {
      div.scrollIntoView();
      return document.body.scrollHeight;
    }, section);
    let scrollHeight = 0;
    for (let i = 0; i <= totalHeight; i += this.height) {
      const part_name = `../screenshots/article_${i / this.height}.png`;
      await page.screenshot({
        path: part_name,
      });
      await page.evaluate(
        distance => window.scrollBy(0, distance),
        this.height,
      );
      scrollHeight += this.height;
      await page.waitFor(500);
      totalHeight = await page.evaluate(() => {
        return document.body.scrollHeight;
      });
    }
    return totalHeight / this.height;
  }

  async generatePDF(size: number, title, author) {
    const doc = new PDFDocument();
    const filename = title.replace(/[/\\?%*:|"<>]/g, '-');

    doc.pipe(fs.createWriteStream(`../articles/${filename}.pdf`));
    for (let i = 0; i <= size; i++) {
      const part_name = `../screenshots/article_${i}.png`;
      doc
        .addPage({
          margins: { top: 0, left: 0, right: 0, bottom: 0 },
          size: [this.width, this.height],
        })
        .image(part_name);
    }
    doc.info.Author = author;
    doc.end();
    for (let i = 0; i <= size; i++) {
      const part_name = `../screenshots/article_${i}.png`;
      await fs.promises.unlink(part_name);
    }
  }
}
