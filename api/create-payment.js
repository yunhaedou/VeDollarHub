import { db } from './utils/firebase.js';
import axios from 'axios';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { username, email, password, whatsapp, product, price, category } = req.body;
    
    // 1. Buat Order ID Unik
    const orderId = `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 2. Simpan Data Order ke Firebase (Status: PENDING)
    await db.collection('orders').doc(orderId).set({
        username, email, password, whatsapp,
        product, price, category,
        status: 'PENDING',
        createdAt: new Date().toISOString()
    });

    // 3. Request Link ke Paykasir (Contoh implementasi standar)
    // NOTE: Sesuaikan URL dan API Key Paykasir kamu disini
    try {
        const paykasirPayload = {
            api_key: process.env.PAYKASIR_API_KEY,
            order_id: orderId,
            amount: price,
            callback_url: `${process.env.VERCEL_URL}/api/webhook`, // URL Webhook kita
            description: `Pembelian ${product}`
        };

        // Ganti URL ini dengan URL create payment Paykasir yang benar
        // const payRes = await axios.post('https://api.paykasir.com/v1/create', paykasirPayload);
        
        // KARENA SAYA TIDAK PUNYA AKUN PAYKASIR:
        // Saya simulasikan return link sukses. Nanti kamu ganti logic ini.
        
        return res.status(200).json({
            success: true,
            // payment_url: payRes.data.url, 
            payment_url: "https://paykasir.com/demo/checkout/" + orderId, // Dummy Link
            order_id: orderId
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
