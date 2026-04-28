const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

let accessToken = null;
let donationQueue = []; // Очередь неотправленных донатов

// Главная страница — запуск авторизации в DonationAlerts
app.get('/', (req, res) => {
    const authUrl = `https://www.donationalerts.com/oauth/authorize?` +
        `client_id=${process.env.APP_ID}&` +
        `redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&` +
        `response_type=code&` +
        `scope=oauth-user-show oauth-donation-subscribe oauth-donation-index`;
    res.redirect(authUrl);
});

// Callback, на который DonationAlerts перенаправляет после авторизации
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

// Отдача последнего доната из очереди
app.get('/latest-donation', (req, res) => {
    if (donationQueue.length > 0) {
        const donation = donationQueue.shift(); // забираем один донат и удаляем его из очереди
        res.json(donation);
    } else {
        res.json(null);
    }
});

// Фоновая проверка новых донатов каждые 5 секунд
setInterval(async () => {
    if (!accessToken) return;
    try {
        const response = await axios.get('https://www.donationalerts.com/api/v1/alerts/donations', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const donations = response.data.data;
        // Добавляем все новые донаты в очередь
        for (const last of donations) {
            donationQueue.push({
                id: String(last.alert_id), // уникальный идентификатор доната
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
