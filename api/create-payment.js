import { db } from './utils/firebase.js';

export default async function handler(req, res) {
    // 1. Cek Method
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { username, email, password, whatsapp, product, price, category, ram, cpu, disk } = req.body;

    // 2. Validasi
    if (!username || !email || !password || !whatsapp) {
        return res.status(400).json({ error: 'Data tidak lengkap' });
    }

    try {
        const orderId = `ORDER-${new Date().getTime()}-${Math.floor(Math.random() * 1000)}`;

        // 3. SIAPKAN DATA KE PAKASIR (FORMAT FORM DATA)
        // Pakasir mewajibkan format x-www-form-urlencoded, bukan JSON.
        const params = new URLSearchParams();
        params.append('api_key', process.env.PAKASIR_API_KEY);
        params.append('project_id', process.env.PAKASIR_PROJECT_ID);
        params.append('amount', price);
        params.append('order_id', orderId);
        params.append('description', `Beli ${product}`);
        params.append('payment_method', 'qris');
        params.append('customer_name', username);
        params.append('customer_email', email);
        params.append('customer_phone', whatsapp);

        // 4. KIRIM FETCH
        const pakasirReq = await fetch('https://pakasir.com/api/create-transaction', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded' // <--- INI KUNCINYA
            },
            body: params // Kirim params, bukan JSON.stringify
        });

        const pakasirRes = await pakasirReq.json();

        // 5. Cek Respon
        if (!pakasirRes.success && !pakasirRes.data?.qr_string && !pakasirRes.qr_string) {
            console.error("Pakasir Gagal:", JSON.stringify(pakasirRes));
            return res.status(500).json({ error: 'Gagal generate QRIS. Cek API Key.' });
        }

        const qrString = pakasirRes.data ? pakasirRes.data.qr_string : pakasirRes.qr_string;

        // 6. Simpan ke Firebase
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
