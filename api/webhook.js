import { db } from './utils/firebase.js';
import { ensurePteroUser, createPteroServer } from './utils/ptero.js';

export default async function handler(req, res) {
    // 1. Validasi Method
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const data = req.body;
    console.log("Webhook Masuk:", JSON.stringify(data)); // Cek di Logs Vercel

    // 2. Ambil Data Sesuai Dokumentasi Pakasir
    // Payload: { "order_id": "...", "status": "completed", ... }
    const orderId = data.order_id;
    const status = data.status; 

    if (!orderId) {
        console.error("Order ID tidak ditemukan dalam webhook");
        return res.status(400).send('No Order ID');
    }

    // 3. Cek Status Pembayaran
    if (status === 'completed' || status === 'success') {
        const orderRef = db.collection('orders').doc(orderId);
        
        try {
            const orderSnap = await orderRef.get();
            if (!orderSnap.exists) {
                console.error("Order tidak ditemukan di Firebase:", orderId);
                return res.status(404).send('Order not found');
            }
            
            const orderData = orderSnap.data();
            if (orderData.status === 'PAID') {
                return res.status(200).send('Already Processed');
            }

            // --- PERUBAHAN UTAMA DISINI ---
            // KITA UPDATE STATUS JADI 'PAID' DULUAN AGAR POPUP DI WEBSITE LANGSUNG TERTUTUP
            // Walaupun nanti pembuatan server gagal, user tau pembayarannya sudah masuk.
            await orderRef.update({ 
                status: 'PAID', 
                paidAt: new Date().toISOString(),
                payment_method: data.payment_method || 'qris',
                pakasir_data: data // Simpan data mentah dari Pakasir untuk debug
            });
            console.log("Status Firebase diupdate ke PAID:", orderId);

            // 4. Proses Pembuatan Server (Dalam Try-Catch Terpisah)
            // Agar jika ini error, status PAID tidak batal.
            try {
                console.log("Mulai membuat user Pterodactyl...");
                const pteroUserId = await ensurePteroUser({
                    email: orderData.email,
                    username: orderData.username,
                    password: orderData.password
                });

                console.log("User Ptero OK. ID:", pteroUserId, "Membuat Server...");

                const resources = {
                    ram: orderData.ram || 1024,
                    cpu: orderData.cpu || 100,
                    disk: orderData.disk || 1000
                };
                
                await createPteroServer(pteroUserId, orderData.category, resources);
                console.log("Server Berhasil Dibuat Otomatis!");
                
                // Opsional: Update lagi statusnya jadi "SERVER_CREATED" jika mau detail
                
            } catch (pteroError) {
                // JIKA SERVER GAGAL DIBUAT:
                console.error("GAGAL AUTO-CREATE SERVER:", pteroError);
                // Kita tidak throw error agar webhook tetap dianggap sukses oleh Pakasir
                // Admin harus cek log dan buat server manual
            }

            return res.status(200).json({ success: true });

        } catch (error) {
            console.error("Webhook Error Fatal:", error);
            return res.status(500).send('Internal Server Error');
        }
    }

    // Jika status pending/failed
    return res.status(200).send('Status ignored');
}
