import { db } from './utils/firebase.js';
import axios from 'axios'; 

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { username, email, password, whatsapp, product, price, category, ram, cpu, disk } = req.body;
    
    // Buat Order ID Unik: TRX-[AngkaWaktu]
    const orderId = `TRX-${Date.now()}`;

    try {
        // 1. Simpan Data Order ke Firebase (Status: PENDING)
        await db.collection('orders').doc(orderId).set({
            username, email, password, whatsapp,
            product, price, category,
            ram: ram || 1024, 
            cpu: cpu || 100, 
            disk: disk || 1000,
            status: 'PENDING',
            createdAt: new Date().toISOString()
        });

        // 2. REQUEST KE PAYKASIR (REAL CONNECTION)
        // Kita minta QRIS string khusus untuk transaksi ini
        const response = await axios.post('https://io.paykasir.com/api/v1/transaction', {
            api_key: process.env.PAYKASIR_API_KEY, // Pastikan ini ada di Vercel Env
            order_id: orderId,
            amount: parseInt(price), // Wajib Angka (Integer)
            type: "qris",            // Kita minta tipe QRIS
            valid_time: 300          // QR Expired dalam 300 detik (5 menit)
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        const paykasirData = response.data;

        // Cek response dari Paykasir sukses atau tidak
        if (!paykasirData.success && paykasirData.code !== 200) {
            throw new Error(paykasirData.message || "Gagal request ke Paykasir");
        }

        // Ambil QR String (Biasanya ada di dalam object 'data')
        // Struktur Paykasir biasanya: { data: { qris_content: "000201..." } }
        const qrString = paykasirData.data ? paykasirData.data.qris_content : paykasirData.qris_content;

        if (!qrString) {
            throw new Error("Paykasir tidak mengirimkan QR String.");
        }

        // 3. Kirim Balik ke Frontend untuk ditampilkan di Popup
        return res.status(200).json({
            success: true,
            qris_content: qrString, 
            order_id: orderId
        });

    } catch (error) {
        // Log error lengkap di Vercel Console jika gagal
        console.error("Payment Error:", error.response ? error.response.data : error.message);
        
        return res.status(500).json({ 
            error: "Gagal membuat pembayaran. Cek log server.",
            originalError: error.message 
        });
    }
}
