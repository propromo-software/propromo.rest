import { spawn } from 'node:child_process';
const DEV_MODE = process.env.DEV_MODE! === "true";

// biome-ignore lint/complexity/noStaticOnlyClass:
export abstract class Heroku { // only possible with their cli-tool (see https://stackoverflow.com/questions/78073975/heroku-run-via-their-node-heroku-client)
  static async dropAndCreateTables(framework = "Laravel"): Promise<string> {
    let response = "";

    switch (framework) {
      case "Laravel":
        response = await Heroku.run("php artisan migrate:fresh"); // "Olles weg, hod funktioniert 💀";
        break;
      default: {
        const errorMessage = `Framework '${framework}' not supported`;
        console.error(errorMessage);
        response = errorMessage;
      }
    }

    if (DEV_MODE) console.log(response);

    return response;
  }

  static async run(command: string, app = "propromo"): Promise<string> {
    return new Promise((resolve, reject) => {
      const herokuCommand = `heroku run ${command} --app ${app}`;
      const herokuRun = spawn('bash', ['-c', `HEROKU_API_KEY='${process.env.HEROKU_API_TOKEN}' ${herokuCommand}`]);

      let result = false;
      const log = [] as string[];

      herokuRun.stdout.on('data', (data: string) => {
        if (DEV_MODE) console.log(`stdout: ${data}`);
        log.push(`${data}`);

        if (data.includes('Are you sure you want to run this command?')) {
          herokuRun.stdin.write('y', () => {
            herokuRun.stdin.write('\n');
          });
        }
      });

      // biome-ignore lint/suspicious/noExplicitAny:
      herokuRun.stderr.on('data', (data: any) => {
        if (DEV_MODE) console.error(`stderr: ${data}`);
      });

      // biome-ignore lint/suspicious/noExplicitAny:
      herokuRun.on('exit', (code: any) => {
        if (DEV_MODE) console.log(`child exited with code ${code}`);

        if (code === 0) {
          // biome-ignore lint/suspicious/noControlCharactersInRegex:
          const sanitizedLog = log.join('').replace(/\u001B\[[0-9;]*[mBDA]/g, ''); // sanitize the log from ansi escape codes, so that the includes condition doesn't fail
          if (DEV_MODE) console.log(sanitizedLog);

          if (sanitizedLog.includes('Dropping all tables')) {
            result = true;
          }

          resolve(`successful: ${result}`);
        } else {
          reject(`error code: ${code}`);
        }
      });
    });
  }
}

/* (async () => {
  try {
    let result = await Heroku.dropAndCreateTables();
    if (DEV_MODE) console.log(result);
  } catch (error) {
    console.error(error);
  }
})(); */
