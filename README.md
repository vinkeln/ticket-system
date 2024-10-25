# Ticket System

## Project Overview
This is a simple ticketing system where users can create tickets, attach files, and assign categories. Agents can manage the tickets, assign categories, and track the status of the tickets.
There is also a knowledge base where both customers and agents can search for articles.

## Features
- Create tickets with descriptions of issues.
- Upload and attach files to tickets.
- Assign categories to tickets.
- Filter and sort tickets based on description, category, and status.
- Agents can create new categories.
- Add comments
- Update tickets status
- Log in with SSO-system
- Add articles and read articles at the knowledge page.

## Requirements
- Node.js
- MySQL
- Express.js

## Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/vinkeln/ticket-system.git

cd ticket-system

npm install


## Start server
node server.js

## Test
npm install mocha chai sinon --save-dev
npm test



## Add .env file
SECRET=<your_secret>
BASEURL=http://localhost:3000
CLIENTID=<your_client_id>
ISSURER=<your_issuer>
EMAIL_USER=<your_email>
EMAIL_PASS=<your_email_password>

## License
MIT License

Copyright (c) 2024 Linn Christiansson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.



