import 'source-map-support/register';
import { MediumScraper } from './medium';

const medium = new MediumScraper();
medium
  .start()
  .then()
  .catch(error => {
    console.log(error);
  })
  .finally(() => {
    process.exit(1);
  });

// medium.runBrowser();
