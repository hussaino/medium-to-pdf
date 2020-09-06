import 'source-map-support/register';
import { MediumScraper } from './medium';

const medium = new MediumScraper();
medium
  .start()
  .then(() => medium.copyFilesToKindle())
  .catch(error => {
    console.log(error);
    // process.exit(1);
  });
