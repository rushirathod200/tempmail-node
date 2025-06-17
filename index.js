const axios = require('axios');
const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

let latestMessage = null;
let email = '';
let token = '';
let index=0;
let processedIds = new Set(); 

let messages=[];

async function createTempEmail() {
  try {
    const domainRes = await axios.get('https://api.mail.tm/domains');
    const domain = domainRes.data['hydra:member'][0].domain;
    email = `user${Math.floor(Math.random() * 10000)}@${domain}`;
    const password = 'Password123!';

    await axios.post('https://api.mail.tm/accounts', { address: email, password });
    const tokenRes = await axios.post('https://api.mail.tm/token', { address: email, password });
    token = tokenRes.data.token;

    console.log(`📧 Temp email: ${email}`);
    console.log(`🔐 Token: ${token}`);
  } catch (error) {
    console.error(' Failed to create temp email:', error.message);
  }
}

const checkInbox = async () => {
  try {
    const res = await axios.get('https://api.mail.tm/messages', {
      headers: { Authorization: `Bearer ${token}` },
    });

    const inbox = res.data['hydra:member'];

    for (const msgSummary of inbox) {
      if (!processedIds.has(msgSummary.id)) {
        const msg = await axios.get(`https://api.mail.tm/messages/${msgSummary.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const latestMessage = {
          from: msg.data.from.address,
          name: msg.data.from.name,
          subject: msg.data.subject,
          text: msg.data.text,
        };

        messages.push(latestMessage);
        processedIds.add(msgSummary.id);  

        io.emit('newEmail', latestMessage);
        console.log(" Sent to client:", latestMessage);

        console.log(`\n New Message:\nFrom: ${latestMessage.from}\nSubject: ${latestMessage.subject}`);
      }
    }

    if (inbox.length === 0) {
      console.log(' No new messages...');
    }
  } catch (error) {
    console.error(" Error checking inbox:", error.message);
  }
};

setInterval(checkInbox, 10000);

app.get('/', async (req, res) => { 
    console.log("value of message:",messages);
  res.render('home', { email, latestMessage: messages  });
});

server.listen(2000, async () => {
  await createTempEmail();
  console.log(' Server running at http://localhost:2000');
});

