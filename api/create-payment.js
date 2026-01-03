import { db } from './utils/firebase.js';

export default async function handler(req, res) {
    // 1. Cek Method & Input
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { username, email, password, whatsapp, product, price, category, ram, cpu, disk } = req.body;

    if (!username || !email || !password || !whatsapp) {
        return res.status(400).json({ error: 'Data formulir tidak lengkap.' });
    }

    try {
        // 2. Buat Order ID
        const orderId = `ORDER-${new Date().getTime()}-${Math.floor(Math.random() * 1000)}`;
        
        // 3. Request QRIS ke Pakasir
        // Kita tidak cek username ptero disini, karena nanti webhook yang akan handle randomizernya
        const payload = {
            api_key: process.env.PAKASIR_API_KEY,
            project_id: process.env.PAKASIR_PROJECT_ID,
            amount: price,
            order_id: orderId,
            description: `Beli ${product}`,
            payment_method: "qris",
            customer_name: username,
            customer_email: email,
            customer_phone: whatsapp
        };

        const pakasirReq = await fetch('https://pakasir.com/api/create-transaction', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(payload)
        });

        const pakasirRes = await pakasirReq.json();

        // 4. Validasi Respon Pakasir
        if (!pakasirRes.success && !pakasirRes.data?.qr_string && !pakasirRes.qr_string) {
            console.error("Pakasir Failed:", JSON.stringify(pakasirRes));
            const msg = pakasirRes.message || "Gagal membuat QRIS (Cek Config)";
            return res.status(500).json({ error: msg });
        }

        const qrString = pakasirRes.data ? pakasirRes.data.qr_string : pakasirRes.qr_string;

        // 5. Simpan Order ke Firebase
        // Kita simpan username ASLI inputan user dulu. 
        // Nanti Webhook yang akan mengupdate ini jika berubah jadi 'caspertes80'
        await db.collection('orders').doc(orderId).set({
            order_id: orderId,
            username, email, password, whatsapp,
            product, price, category,
            ram, cpu, disk,
            status: 'PENDING',
            qris_content: qrString,
            createdAt: new Date().toISOString()
        });

        // 6. Sukses
        return res.status(200).json({
            success: true,
            order_id: orderId,
            qris_content: qrString
        });

    } catch (error) {
        console.error("Create Payment Error:", error);
        return res.status(500).json({ error: 'System Error: ' + error.message });
    }
}
