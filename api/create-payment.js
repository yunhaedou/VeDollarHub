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

        // 2. REQUEST KE PAKASIR (Domain Sudah Diperbaiki)
        // Environment Variable 'PAYKASIR_API_KEY' biarkan saja namanya, tapi pastikan isinya API Key dari Pakasir.com
        
        // PENTING: Cek link docs Anda (pakasir.com/p/docs) untuk Endpoint URL pastinya.
        // Biasanya formatnya seperti di bawah ini. Jika error 404, berarti path '/v1/transaction' harus diganti sesuai docs.
        
        const response = await axios.post('https://api.pakasir.com/v1/transaction', {
            api_key: process.env.PAYKASIR_API_KEY, 
            order_id: orderId,
            amount: parseInt(price), 
            type: "qris",            
            valid_time: 300,
            description: `Pembelian ${product}`
        }, {
            headers: { 'Content-Type': 'application/json' }
        });

        const resultData = response.data;

        // Cek Response Sukses/Gagal
        if (!resultData.success && resultData.code !== 200) {
            throw new Error(resultData.message || "Gagal request ke Pakasir");
        }

        // Ambil QR String dari response Pakasir
        // Sesuaikan key 'qris_content' dengan apa yang tertulis di Docs Pakasir jika nanti masih kosong
        const qrString = resultData.data ? resultData.data.qris_content : resultData.qris_content;

        if (!qrString) {
            // Fallback: Jika Pakasir tidak kasih string QR, mungkin dia kasih URL Image
            const qrImage = resultData.data ? resultData.data.qr_image : resultData.qr_image;
            if(qrImage) {
                 // Jika dapatnya URL Gambar, kita kirim itu saja tapi frontend harus disesuaikan sedikit.
                 // Tapi semoga dapat qris_content string.
                 throw new Error("API Pakasir mereturn URL Gambar, bukan String QRIS. Cek Docs.");
            }
            throw new Error("Pakasir tidak mengirimkan QR String.");
        }

        // 3. Kirim Balik ke Frontend
        return res.status(200).json({
            success: true,
            qris_content: qrString, 
            order_id: orderId
        });

    } catch (error) {
        console.error("Payment Error:", error.response ? error.response.data : error.message);
        
        // Pesan Error yang ramah di user
        return res.status(500).json({ 
            error: "Gagal memproses pembayaran. Pastikan API Key Pakasir Benar.",
            details: error.message 
        });
    }
}
