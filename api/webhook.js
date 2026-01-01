import { db } from './utils/firebase.js';
import { ensurePteroUser, createPteroServer } from './utils/ptero.js';

export default async function handler(req, res) {
    // 1. Cek Method
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const data = req.body;
    console.log("Webhook Received:", data); // Untuk cek di Log Vercel

    // 2. Ambil Data dari Paykasir
    // Paykasir biasanya mengirim: order_id, status, dll.
    const orderId = data.order_id || data.trx_id; 
    const status = data.status; 

    // 3. Logic Validasi Sederhana
    // Karena tidak ada secret key, kita validasi by Order ID di database
    if (!orderId) return res.status(400).send('No Order ID');

    if (status === 'success' || status === 'paid' || status === 'settlement') {
        const orderRef = db.collection('orders').doc(orderId);
        const orderSnap = await orderRef.get();

        if (!orderSnap.exists) return res.status(404).send('Order not found in DB');
        const orderData = orderSnap.data();

        // Cek supaya tidak diproses 2x
        if (orderData.status === 'PAID') return res.status(200).send('Already Processed');

        try {
            // A. Update Status Firebase
            await orderRef.update({ status: 'PAID', paidAt: new Date().toISOString() });

            // B. Create Pterodactyl User
            const pteroUserId = await ensurePteroUser({
                email: orderData.email,
                username: orderData.username,
                password: orderData.password
            });

            // C. Create Pterodactyl Server
            // Default RAM 1GB (1024) jika tidak ada di nama produk
            const ramSize = 1024; 
            
            await createPteroServer(pteroUserId, orderData.category, ramSize);

            return res.status(200).json({ success: true });

        } catch (error) {
            console.error("Auto-Create Failed:", error);
            // Jangan update status FAILED agar admin bisa retry manual jika mau
            return res.status(500).send('Provisioning Failed: ' + error.message);
        }
    }

    return res.status(200).send('OK');
}
