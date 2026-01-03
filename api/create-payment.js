import { db } from './utils/firebase.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { username, email, password, whatsapp, product, price, category, ram, cpu, disk } = req.body;

    if (!username || !email || !password || !whatsapp) {
        return res.status(400).json({ error: 'Data tidak lengkap' });
    }

    try {
        const orderId = `ORDER-${new Date().getTime()}-${Math.floor(Math.random() * 1000)}`;

        // Sesuai Dokumentasi Gambar:
        // URL: https://app.pakasir.com/api/transactioncreate/qris
        // Body: project, order_id, amount, api_key
        const payload = {
            api_key: process.env.PAKASIR_API_KEY,
            project: process.env.PAKASIR_PROJECT_ID,
            amount: parseInt(price),
            order_id: orderId,
            description: `Beli ${product}`,
            payment_method: "qris",
            customer_name: username,
            customer_email: email,
            customer_phone: whatsapp
        };

        const pakasirReq = await fetch('https://app.pakasir.com/api/transactioncreate/qris', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!pakasirReq.ok) {
            const errText = await pakasirReq.text();
            console.error("Pakasir HTTP Error:", pakasirReq.status, errText);
            return res.status(pakasirReq.status).json({ 
                error: `Koneksi Pakasir Gagal (${pakasirReq.status}). Cek API Key/Project ID.` 
            });
        }

        const pakasirRes = await pakasirReq.json();

        // LOGIC BARU BERDASARKAN SCREENSHOT:
        // Respon sukses ada di dalam object "payment", key-nya "payment_number"
        let qrString = null;

        if (pakasirRes.payment && pakasirRes.payment.payment_number) {
            qrString = pakasirRes.payment.payment_number;
        } 
        // Jaga-jaga jika formatnya beda (backup check)
        else if (pakasirRes.data?.qr_string) {
            qrString = pakasirRes.data.qr_string;
        }
        else if (pakasirRes.qr_string) {
            qrString = pakasirRes.qr_string;
        }

        // Jika QR Kosong, berarti Gagal atau Error dari Pakasir
        if (!qrString) {
            console.error("Pakasir Response Raw:", JSON.stringify(pakasirRes));
            // Tampilkan error asli dari JSON response jika ada
            const msg = pakasirRes.message || pakasirRes.error || "Format Respon Pakasir Tidak Dikenali";
            return res.status(500).json({ error: `Gagal: ${msg}` });
        }

        // Simpan ke Firebase
        await db.collection('orders').doc(orderId).set({
            order_id: orderId,
            username, email, password, whatsapp,
            product, price, category,
            ram, cpu, disk,
            status: 'PENDING',
            qris_content: qrString,
            createdAt: new Date().toISOString()
        });

        return res.status(200).json({
            success: true,
            order_id: orderId,
            qris_content: qrString
        });

    } catch (error) {
        console.error("System Error:", error);
        return res.status(500).json({ error: 'System Error: ' + error.message });
    }
}
