import { db } from './utils/firebase.js';
import axios from 'axios'; 

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { username, email, password, whatsapp, product, price, category, ram, cpu, disk } = req.body;
    
    // Order ID Unik
    const orderId = `TRX-${Date.now()}`;

    try {
        // 1. Simpan ke Firebase (Status: PENDING)
        await db.collection('orders').doc(orderId).set({
            username, email, password, whatsapp,
            product, price, category,
            ram: ram || 1024, 
            cpu: cpu || 100, 
            disk: disk || 1000,
            status: 'PENDING',
            createdAt: new Date().toISOString()
        });

        // 2. REQUEST KE PAKASIR (Sesuai Screenshot Dokumentasi)
        // URL Endpoint: https://app.pakasir.com/api/transactioncreate/qris
        
        // PENTING: Anda harus menambahkan 'PAKASIR_PROJECT_ID' di Environment Variable Vercel
        // Isinya adalah nama project Anda di Pakasir (contoh di docs: "depodomain")
        
        const response = await axios.post('https://app.pakasir.com/api/transactioncreate/qris', {
            project: process.env.PAKASIR_PROJECT_ID, // WAJIB: Nama project Anda
            order_id: orderId,
            amount: parseInt(price),
            api_key: process.env.PAYKASIR_API_KEY // API Key dari dashboard
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        const resultData = response.data;

        // Cek Response: Pakasir biasanya mengembalikan object "payment" jika sukses
        // Lihat screenshot response: { "payment": { "payment_number": "000201...", ... } }
        
        if (!resultData.payment) {
            console.error("Pakasir Response:", resultData);
            throw new Error("Gagal mengambil data dari Pakasir. Cek Project ID & API Key.");
        }

        const qrString = resultData.payment.payment_number; // Ini QR String-nya (berdasarkan contoh di docs)

        if (!qrString) {
            throw new Error("Pakasir tidak mengirimkan QR String (payment_number kosong).");
        }

        // 3. Kirim Balik ke Frontend
        return res.status(200).json({
            success: true,
            qris_content: qrString, 
            order_id: orderId
        });

    } catch (error) {
        console.error("Payment Error:", error.response ? error.response.data : error.message);
        
        return res.status(500).json({ 
            error: "Gagal memproses pembayaran.",
            details: error.message 
        });
    }
}
