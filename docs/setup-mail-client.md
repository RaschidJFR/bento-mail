## Configure email client to forward newsletters

Using your regular email client, you can forward either manually or automatically your newsletters to the Bento Mail web application so it processes and summarizes your newsletters. Depending on whether your application has been deployed remotely or if you're developing locally, you'll configure your email client differently.

### During local development (a bit tricky)

This step is required only during local development.

#### MacOS

1. Ensure the application's mail server [is running](../README.md#Local-Development)
2. Open the Mail app and [add a new (valid) account](https://support.apple.com/en-ca/guide/mail/mail35803/mac). This account will be modified in the next step but the Mail app won't let you add it unless it is a valid email account on a valide email provider
3. [Modify](https://support.apple.com/en-ca/guide/mail/cpmlprefacctadv/mac) the recently added account
   1. Open the app's settings (`⌘ + ,`), go to _Accounts_ and select the account to modify
   2. Under _Server_ > _Outgoing Mail Server (SMPT)_ click on _Account_ and then on _Edit SMTP Server List…_
      ![](./images/mail%20config.png)
   3. Click on the plus (`+`) button and enter the details for the new server:
      ![](./images/server%20config.png)
      1. Description: `maildev`
      2. User Name: (empty)
      3. Password: (empty)
      4. Host Name: `127.0.0.1`
      5. Port: `1025` (or the one set in your [.env](./../.env.example) file)
      6. Authentication: none
   4. Click _OK_ to close the panel
   5. Select `maildev` as the value for _Outgoing Mail Server (SMPT)_ > _Account_ from the dropdown list.

To send an email to the application running locally just forward any message to any email address from the newly created account. Please note that the `to` address field is not relevant. What is relevant is the `from` field as it uses the local running server.

#### Windows

_Information to be provided_
