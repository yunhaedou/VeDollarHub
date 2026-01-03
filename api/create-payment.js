import { db } from './utils/firebase.js';

export default async function handler(req, res) {
    // 1. Cek Method
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { username, email, password, whatsapp, product, price, category, ram, cpu, disk } = req.body;

    // 2. Validasi Data Masuk
    if (!username || !email || !password || !whatsapp) {
        return res.status(400).json({ error: 'Data formulir tidak lengkap.' });
    }

    try {
        const orderId = `ORDER-${new Date().getTime()}-${Math.floor(Math.random() * 1000)}`;

        // 3. SIAPKAN DATA KE PAKASIR
        // Kita gunakan JSON.stringify karena lebih stabil di Node.js daripada URLSearchParams
        // Pastikan amount diubah menjadi integer (angka bulat)
        const payload = {
            api_key: process.env.PAKASIR_API_KEY,
            project_id: process.env.PAKASIR_PROJECT_ID,
            amount: parseInt(price), // Pastikan ini angka
            order_id: orderId,
            description: `Beli ${product}`,
            payment_method: "qris",
            customer_name: username,
            customer_email: email,
            customer_phone: whatsapp
        };

        // 4. KIRIM KE PAKASIR (Pakai JSON)
        const pakasirReq = await fetch('https://pakasir.com/api/create-transaction', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        // Cek jika URL salah atau server Pakasir down
        if (!pakasirReq.ok) {
            const text = await pakasirReq.text();
            console.error("Pakasir HTTP Error:", text);
            return res.status(500).json({ error: `Pakasir Error: ${pakasirReq.status} ${pakasirReq.statusText}` });
        }

        const pakasirRes = await pakasirReq.json();

        // 5. CEK APAKAH PAKASIR MENOLAK?
        // Jika success false, kita ambil pesan error aslinya
        if (!pakasirRes.success) {
            console.error("Pakasir Menolak:", JSON.stringify(pakasirRes));
            // Ambil pesan error spesifik dari Pakasir
            const msg = pakasirRes.message || pakasirRes.error || "Gagal membuat QRIS (API Key/Project ID Salah?)";
            return res.status(400).json({ error: msg });
        }

        // Ambil QR String (bisa ada di data.qr_string atau langsung di qr_string tergantung versi API)
        const qrString = pakasirRes.data ? pakasirRes.data.qr_string : pakasirRes.qr_string;

        if (!qrString) {
            return res.status(500).json({ error: "QR String tidak ditemukan dalam respon Pakasir." });
        }

        // 6. Simpan ke Firebase (Username ASLI dari input user)
        await db.collection('orders').doc(orderId).set({
            order_id: orderId,
            username, email, password, whatsapp,
            product, price, category,
            ram, cpu, disk,
            status: 'PENDING',
            qris_content: qrString,
            createdAt: new Date().toISOString()
        });

        // 7. Sukses
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
