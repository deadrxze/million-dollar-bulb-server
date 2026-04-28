const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

let accessToken = null;
let donationQueue = [];   // здесь временно хранятся донаты между запросами

app.get('/', (req, res) => {
    const authUrl = `https://www.donationalerts.com/oauth/authorize?` +
        `client_id=${process.env.APP_ID}&` +
        `redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&` +
        `response_type=code&` +
        `scope=oauth-user-show oauth-donation-subscribe oauth-donation-index`;
    res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.send('Authorization code is missing.');

    try {
        const response = await axios.post('https://www.donationalerts.com/oauth/token', {
            grant_type: 'authorization_code',
            client_id: process.env.APP_ID,
            client_secret: process.env.API_KEY,
            redirect_uri: process.env.REDIRECT_URI,
            code: code,
        });
        accessToken = response.data.access_token;
        console.log('Authorization successful!');
        res.send('<h2>Authorization successful! You can close this page.</h2>');
    } catch (error) {
        console.error('Auth error:', error.response?.data || error.message);
        res.status(500).send('Authorization failed.');
    }
});

// Отдаём сразу все накопившиеся донаты и очищаем очередь
app.get('/latest-donation', (req, res) => {
    const batch = donationQueue.splice(0);   // копируем массив и очищаем оригинал
    if (batch.length > 0) {
        res.json(batch);
    } else {
        res.json(null);
    }
});

setInterval(async () => {
    if (!accessToken) return;
    try {
        const response = await axios.get('https://www.donationalerts.com/api/v1/alerts/donations', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const donations = response.data.data;
        for (const last of donations) {
            donationQueue.push({
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                nickname: last.username || 'Anonymous',
                amount: last.amount,
                currency: last.currency,
            });
        }
    } catch (error) {
        console.error('Error fetching donations:', error.response?.data || error.message);
    }
}, 5000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
