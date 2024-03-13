import { spawn } from 'node:child_process';

export class Heroku { // only possible with their cli-tool (see https://stackoverflow.com/questions/78073975/heroku-run-via-their-node-heroku-client)
  static async dropAndCreateTables(framework = "Laravel"): Promise<string> {
    let response = "";

    switch (framework) {
      case "Laravel":
        response = await this.run("php artisan migrate:fresh"); // "Olles weg, hod funktioniert 💀";
        break;
      default:
        const errorMessage = `Framework '${framework}' not supported`;
        console.error(errorMessage);
        response = errorMessage;
    }

    console.log(response);

    return response;
  }

  static async run(command: string, app = "propromo"): Promise<string> {
    return new Promise((resolve, reject) => {
      const herokuCommand = `heroku run ${command} --app ${app}`;
      const herokuRun = spawn('bash', ['-c', `HEROKU_API_KEY='${process.env.HEROKU_API_TOKEN}' ${herokuCommand}`]);

      let result = false;
      let log = [] as string[];

      herokuRun.stdout.on('data', (data: string) => {
        console.log(`stdout: ${data}`);
        log.push(`${data}`);

        if (data.includes('Are you sure you want to run this command?')) {
          herokuRun.stdin.write('y', () => {
            herokuRun.stdin.write('\n');
          });
        }
      });

      herokuRun.stderr.on('data', (data: any) => {
        console.error(`stderr: ${data}`);
      });

      herokuRun.on('exit', (code: any) => {
        console.log(`child exited with code ${code}`);

        if (code === 0) {
          const sanitizedLog = log.join('').replace(/\u001B\[[0-9;]*[mBDA]/g, ''); // sanitize the log from ansi escape codes, so that the includes condition doesn't fail
          console.log(sanitizedLog);

          if (sanitizedLog.includes('Dropping all tables')) {
            result = true;
          }

          resolve("successful: " + result);
        } else {
          reject("error code: " + code);
        }
      });
    });
  }
}

/* (async () => {
  try {
    let result = await Heroku.dropAndCreateTables();
    console.log(result);
  } catch (error) {
    console.error(error);
  }
})(); */
