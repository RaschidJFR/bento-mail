# Configure your email client to forward messages

Using your regular email client, you can manually or automatically forward your newsletters to the Bento. Depending on whether your application has been deployed to the cloud or running locally, you'll configure your email client differently.

## When Bento is running locally

Just ensure the application server is running and configure your email client application to point to the local Bento server (⚠️ does not work on browser clients). This configuration example is based on MacOS:

#### Configure Apple Mail

1. Open the Mail app and [add a new account](https://support.apple.com/en-ca/guide/mail/mail35803/mac). This account will be modified in the next step but the Mail app won't let you add it unless it is a valid email account on a valide email provider. Follow the required steps.
2. [Modify](https://support.apple.com/en-ca/guide/mail/cpmlprefacctadv/mac) the recently added account:
   1. Open the app's settings (`⌘ ,`), go to _Accounts_ and select the account to modify.
   2. You can rename the account to whatever you like ('MailDev' in this example) by changing the value in the _Description_ field under the _Account Information_ tab.
      ![](./images/account%20info.png)
   3. Now go to the _Server Settings_ tab. You can leave whatever values under the _Incoming Mail Server (IMAP)_ section. These will not be used by Bento. Under _Server_ > _Outgoing Mail Server (SMPT)_ click on _Account_ and then on _Edit SMTP Server List…_
      ![](./images/mail%20config.png)
   4. Click on the plus (`+`) button and enter the details for the new server:
      ![](./images/server%20config.png)
      1. Description: `localhost` (or whatever name you want)
      2. User Name: (empty)
      3. Password: (empty)
      4. Host Name: `127.0.0.1`
      5. Port: `1025` (or the one set in your [.env](./../.env.example) file)
      6. Authentication: none
   5. Click _OK_ to close the panel
   6. Select the new `localhost` as the value for _Outgoing Mail Server (SMPT)_ > _Account_ from the dropdown list and close the configuration panel.
      ![](./images/select%20server.png)
3. To forward an email to Bento just click 'forward' as you normally do, and select the newly added account in the field `From:`
   ![](./images/forward%20email.png)
4. Wait a couple of minutes for the AI to extract your content and go to Bento's web interface in your browser using the email you set in the field `To:` when sending the email\*. For the previous example that would be: [http://localhost:3000?user=your@email.address](http://localhost:3000?user=your@email.address)

\* This pseudo-login mechanism will be properly implemented in the future. For now it is enough to provide the user's email in the browser's url.

## When Bento has been deployed

### 1. Setup a mail server

The easiest way to set up a compatible mail server to receive your newsletters and forward them to Bento for processing is to create an account on [ForwardEmail.net](https://forwardemail.net/en). Follow their [documentation](https://forwardemail.net/en/faq#quick-start) to set up an email alias and point it to `https://<yourappdomain>/api/email` (no trailing slash!). The next step is to configure your email provider to send your received newsletters to ForwardEmail.net.

### 2. Setup filters

## Gmail

Set up a filter for the email addresses of your newsletters. See [this article](https://support.google.com/mail/answer/10957?hl=en) to learn how.

## iCloud

Set up a rule to forward the email addresses of your newsletters. See [this article](https://support.apple.com/en-ca/guide/icloud/mm6b1a3f8a/icloud) to learn how.
