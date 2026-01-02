import { db } from './utils/firebase.js';
import axios from 'axios'; // <--- WAJIB ADA (Biar ga error module not found)

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    // Menerima data spek (ram, cpu, disk) dari frontend
    const { username, email, password, whatsapp, product, price, category, ram, cpu, disk } = req.body;
    
    // Generate Order ID Unik
    const orderId = `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    try {
        // 1. Simpan ke Firebase (Status PENDING)
        await db.collection('orders').doc(orderId).set({
            username, email, password, whatsapp,
            product, price, category,
            ram: ram || 1024,
            cpu: cpu || 100,
            disk: disk || 1000,
            status: 'PENDING',
            createdAt: new Date().toISOString()
        });

        // 2. Siapkan Data untuk Paykasir
        // Trik: Pastikan URL ada https:// nya
        const baseUrl = process.env.VERCEL_URL 
            ? `https://${process.env.VERCEL_URL}` 
            : 'https://vedollarhub.vercel.app'; // Fallback manual biar aman

        const paykasirPayload = {
            api_key: process.env.PAYKASIR_API_KEY,
            order_id: orderId,
            amount: price, // Pastikan ini angka/string murni tanpa Rp
            callback_url: `${baseUrl}/api/webhook`, 
            description: `Beli ${product}`
        };

        // --- OPSI 1: MODE TESTING (Pura-pura sukses) ---
        // Gunakan ini dulu untuk memastikan database tersimpan tanpa memanggil Paykasir asli
        return res.status(200).json({
            success: true,
            payment_url: "https://paykasir.com/demo/checkout/" + orderId, 
            order_id: orderId
        });

        // --- OPSI 2: MODE ASLI (Uncomment ini nanti kalau database sudah fix) ---
        /*
        const payRes = await axios.post('https://api.paykasir.com/v1/create', paykasirPayload);
        return res.status(200).json({
            success: true,
            payment_url: payRes.data.url, // Ambil link asli dari Paykasir
            order_id: orderId
        });
        */

    } catch (error) {
        console.error("Payment Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
