# DataAnnotation Project Notifier

A Tampermonkey userscript that watches the DataAnnotation projects dashboard and notifies you when new projects appear.

## What it does

This script checks the DataAnnotation projects page for visible projects. On first run, it saves the currently visible projects as a baseline. After that, if a project appears that is not part of the saved baseline, the script can notify you with:

* A browser notification
* A Telegram message
* Project name, pay, and task count when available

The script also includes manual console controls for testing notifications, viewing current projects, resetting the baseline, and clearing stored data.

## Installation

1. Install Tampermonkey in your browser.
2. Create a new userscript.
3. Paste the contents of `dataannotation-project-notifier.user.js`.
4. Save the script.
5. Open the DataAnnotation projects dashboard.

## Important Setup

Before using Telegram notifications, add your own Telegram bot token and chat ID.

Do not commit your real Telegram bot token to GitHub.

Use placeholder values in the public version of the script, such as:

```js
telegramBotToken: "PASTE_YOUR_BOT_TOKEN_HERE",
telegramChatId: "PASTE_YOUR_CHAT_ID_HERE",
```

## Manual Controls

Open the browser console on the DataAnnotation projects page and run:

```js
DANotifier.showCurrentProjects()
```

Shows the current projects detected by the script.

```js
DANotifier.setBaselineToCurrent()
```

Sets the current visible projects as the baseline.

```js
DANotifier.clearBaseline()
```

Clears the saved baseline.

```js
DANotifier.testBrowserNotification()
```

Tests browser notifications.

```js
DANotifier.testTelegram()
```

Tests Telegram notifications.

```js
DANotifier.showStoredData()
```

Shows stored baseline and last-seen project data.

## Notes

This script runs only on:

```text
https://app.dataannotation.tech/workers/projects*
```

Use responsibly and make sure your use follows DataAnnotation’s terms and policies.

## License

MIT
