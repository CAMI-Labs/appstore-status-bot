import axios from "axios";
import { exec } from "child_process";
import dirty from "dirty";
import { promises as fs } from "fs";
import { Octokit } from "octokit";

import * as discord from "./discord.js";
import * as env from "./env.js";
import * as slack from "./slack.js";

const octokit = new Octokit({ auth: `token ${env.GH_TOKEN}` });
const gist_id = env.GIST_ID;

const getGist = async () => {
  const gists = await octokit.rest.gists
    .get({ gist_id })
    .catch((error) => console.error(`[*] Unable to update gist\n${error}`));
  if (!gists) {
    return;
  }

  const filename = Object.keys(gists.data.files)[0];
  const rawdataURL = gists.data.files[filename].raw_url;

  const response = await axios.get(rawdataURL);
  try {
    // Convert response.data to a string before writing
    const data =
      typeof response.data === "object"
        ? JSON.stringify(response.data)
        : response.data;

    await fs.writeFile("store.db", data);
    console.debug("[*] file saved!");
  } catch (error) {
    console.error(error);
  }
};

const updateGist = async (content) => {
  const gists = await octokit.rest.gists
    .get({ gist_id })
    .catch((error) => console.error(`[*] Unable to update gist\n${error}`));
  if (!gists) {
    return;
  }

  const filename = Object.keys(gists.data.files)[0];
  await octokit.rest.gists.update({
    gist_id,
    files: {
      [filename]: {
        content,
      },
    },
  });
};

const checkVersion = async (app) => {
  const appInfoKey = "appInfo-" + app.appID;
  const submissionStartKey = "submissionStart" + app.appID;

  const db = dirty("store.db");
  db.on("load", async function () {
    const lastAppInfo = db.get(appInfoKey);
    if (!lastAppInfo || lastAppInfo.status != app.status) {
      console.debug("[*] status is different");

      slack.post(app, db.get(submissionStartKey));
      discord.post(app, db.get(submissionStartKey));

      if (app.status == "Waiting For Review") {
        db.set(submissionStartKey, new Date());
      }
    } else {
      console.error("[*] status is same");
    }

    db.set(appInfoKey, app);

    try {
      const data = await fs.readFile("store.db", "utf-8");
      await updateGist(data);
    } catch (error) {
      console.error(error);
    }
  });
};

const main = async () => {
  await getGist();

  exec(
    "ruby Sources/fetch_app_status.rb",
    { env },
    function (_error, stdout, stderr) {
      if (stdout) {
        const apps = JSON.parse(stdout);
        console.debug(apps);
        for (const app of apps) {
          checkVersion(app);
        }
      } else {
        console.error("There was a problem fetching the status of the app!");
        console.error(stderr);
      }
    },
  );
};

main();
