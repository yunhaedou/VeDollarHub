import { db } from './utils/firebase.js';
import { ensurePteroUser, createPteroServer } from './utils/ptero.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const data = req.body;
    
    // 1. VALIDASI SIGNATURE PAYKASIR (WAJIB!)
    // Cek dokumentasi Paykasir untuk validasi signature agar tidak di-hack.
    // Contoh dummy check:
    // if (data.secret_key !== process.env.PAYKASIR_CALLBACK_KEY) return res.status(403).send('Invalid Key');

    const orderId = data.order_id; 
    const status = data.status; // Misal: 'success' atau 'paid'

    if (status === 'success' || status === 'paid') {
        const orderRef = db.collection('orders').doc(orderId);
        const orderSnap = await orderRef.get();

        if (!orderSnap.exists) return res.status(404).send('Order not found');
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
            // Asumsi: Nama produk mengandung info RAM, misal "MC Stone (4GB)"
            // Kita ambil angka 4096 dari nama produk atau set manual di frontend logic.
            // Untuk simpelnya, kita set default 1024MB dulu disini.
            const ramSize = 1024; 
            
            const serverInfo = await createPteroServer(pteroUserId, orderData.category, ramSize);

            // D. (Opsional) Kirim WA Notif disini
            console.log("Server Created:", serverInfo.uuid);

            return res.status(200).json({ success: true, server_id: serverInfo.id });

        } catch (error) {
            console.error("Auto-Create Failed:", error);
            await orderRef.update({ status: 'FAILED_PROVISION', error: error.message });
            return res.status(500).send('Provisioning Failed');
        }
    }

    return res.status(200).send('OK');
}
