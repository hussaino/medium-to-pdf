## Description

This repo is a TypeScript script that turns your reading list from Medium to PDFs then checks if you have your Kindle attached and copies the PDFs to your Kindle.

## Why?

I read Medium articles a lot, and that causes eye strain when reading on my phone, even with night shift turned on. I also own a Kindle, which is great for reading, but doesn't have a real browser to use for Medium.com

P.S. I use Medium Premium which I pay for and I don't condone piracy of printing Medium articles in a way that doesn't match their T&Cs

## How it works

First I love TypeScript, so you can either use tsc to convert this to plain JavaScript then run `node dist/main.js` or just use `npx ts-node src/main.ts`

If you own Kindle then plug your Kindle before running the script, this script includes a check at the end to see if your Kindle is plugged in and copies the articles there.

If you don't then you can just enjoy your Medium articles in PDF if that's what you're looking for

## How to

First you have to install chromium separately [here](https://download-chromium.appspot.com/).

After that you can run the function `runBrowser()` to open the browser and sign in to your Medium account.

Then you can run the `start()` function and sit back while this script scrapes your Medium reading list and converts them to PDF

This script runs puppeteer in non-headless mode, as I couldn't figure out how to keep the login session alive between non-headless and headless mode.

## Notes

I thought of including sending automatic email with the PDFs to my Kindle, but that would clutter my amazon Docs list, and it would be pretty easy for anyone to add an email sender to this script since it's available everywhere

This script is meant to be run on a Mac, and it looks for Chromium in the Applications folder and for Kindle in the /Volumes folder.

To help improve this script, you can abstract some of the variables to make it run on Windows and maybe find a way to run it in headless mode.
