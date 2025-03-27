import { IncomingWebhook } from "@slack/webhook";
import { I18n } from "i18n";
import moment from "moment";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { LANGUAGE, SLACK_WEBHOOK } from "./env.js";

// __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const i18n = new I18n();

i18n.configure({
  locales: ["en", "ko", "ja"],
  directory: join(__dirname, "../locales"),
  defaultLocale: "en",
});

i18n.setLocale(LANGUAGE || "en");

async function hook(message, attachment) {
  if (!SLACK_WEBHOOK) {
    console.error("No Slack webhook URL provided.");
    return;
  }

  const webhook = new IncomingWebhook(SLACK_WEBHOOK, {});
  await webhook.send({
    text: message,
    attachments: [attachment],
  });
}

function colorForStatus(status) {
  const infoColor = "#8e8e8e";
  const warningColor = "#f4f124";
  const successColor1 = "#1eb6fc";
  const successColor2 = "#14ba40";
  const failureColor = "#e0143d";
  const colorMapping = {
    "Prepare for Submission": infoColor,
    "Waiting For Review": infoColor,
    "In Review": successColor1,
    "Pending Contract": warningColor,
    "Waiting For Export Compliance": warningColor,
    "Pending Developer Release": successColor2,
    "Processing for App Store": successColor2,
    "Pending Apple Release": successColor2,
    "Ready for Sale": successColor2,
    Rejected: failureColor,
    "Metadata Rejected": failureColor,
    "Removed From Sale": failureColor,
    "Developer Rejected": failureColor,
    "Developer Removed From Sale": failureColor,
    "Invalid Binary": failureColor,
  };

  return colorMapping[status];
}

function slackAttachment(appInfo, submissionStartDate) {
  const attachment = {
    fallback: `The status of your app ${appInfo.name} has been changed to ${appInfo.status}`,
    color: colorForStatus(appInfo.status),
    title: "App Store Connect",
    author_name: appInfo.name,
    author_icon: appInfo.iconURL,
    title_link: `https://appstoreconnect.apple.com/apps/${appInfo.appID}/appstore`,
    fields: [
      {
        title: i18n.__("Version"),
        value: appInfo.version,
        short: true,
      },
      {
        title: i18n.__("Status"),
        value: i18n.__(appInfo.status),
        short: true,
      },
    ],
    footer: "appstore-status-bot",
    footer_icon:
      "https://icons-for-free.com/iconfiles/png/512/app+store+apple+apps+game+games+store+icon-1320085881005897327.png",
    ts: new Date().getTime() / 1000,
  };

  // Set elapsed time since "Waiting For Review" start
  if (
    submissionStartDate &&
    appInfo.status != "Prepare for Submission" &&
    appInfo.status != "Waiting For Review"
  ) {
    const elapsedHours = moment().diff(moment(submissionStartDate), "hours");
    attachment.fields.push({
      title: "Elapsed Time",
      value: `${elapsedHours} hours`,
      short: true,
    });
  }
  return attachment;
}

export function post(appInfo, submissionStartDate) {
  const status = i18n.__(appInfo.status);
  const message = i18n.__("Message", { appname: appInfo.name, status });
  const attachment = slackAttachment(appInfo, submissionStartDate);

  hook(message, attachment);
}
