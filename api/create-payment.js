import { db } from './utils/firebase.js';

export default async function handler(req, res) {
    // 1. Cek Method
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { username, email, password, whatsapp, product, price, category, ram, cpu, disk } = req.body;

    // 2. Validasi Data
    if (!username || !email || !password || !whatsapp) {
        return res.status(400).json({ error: 'Data formulir tidak lengkap.' });
    }

    try {
        const orderId = `ORDER-${new Date().getTime()}-${Math.floor(Math.random() * 1000)}`;

        // 3. SIAPKAN DATA (FORMAT FORM DATA)
        // Pakasir biasanya mewajibkan format ini, bukan JSON.
        const params = new URLSearchParams();
        params.append('api_key', process.env.PAKASIR_API_KEY);
        params.append('project_id', process.env.PAKASIR_PROJECT_ID);
        params.append('amount', parseInt(price)); // Pastikan angka bulat
        params.append('order_id', orderId);
        params.append('description', `Beli ${product}`);
        params.append('payment_method', 'qris');
        params.append('customer_name', username);
        params.append('customer_email', email);
        params.append('customer_phone', whatsapp);

        // 4. KIRIM REQUEST (Tanpa Header Content-Type Manual)
        // fetch akan otomatis mendeteksi URLSearchParams dan menambahkan header yang benar
        const pakasirReq = await fetch('https://pakasir.com/api/create-transaction', {
            method: 'POST',
            body: params
        });

        // Cek Status HTTP
        if (!pakasirReq.ok) {
            const errText = await pakasirReq.text();
            console.error("Pakasir HTTP Error:", pakasirReq.status, errText);
            return res.status(pakasirReq.status).json({ 
                error: `Gagal koneksi ke Pakasir (${pakasirReq.status}). Cek URL/API Key.` 
            });
        }

        const pakasirRes = await pakasirReq.json();

        // 5. CEK SUKSES/GAGAL DARI PAKASIR
        if (!pakasirRes.success && !pakasirRes.data?.qr_string && !pakasirRes.qr_string) {
            console.error("Pakasir Menolak:", JSON.stringify(pakasirRes));
            // Tampilkan pesan error asli dari Pakasir
            const msg = pakasirRes.message || pakasirRes.error || "Gagal membuat QRIS (API Key Salah?)";
            return res.status(400).json({ error: msg });
        }

        const qrString = pakasirRes.data ? pakasirRes.data.qr_string : pakasirRes.qr_string;

        // 6. Simpan ke Firebase
        // Kita simpan Username ASLI inputan user (tanpa angka acak)
        // Nanti Webhook yang akan mengupdate jika username berubah
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
