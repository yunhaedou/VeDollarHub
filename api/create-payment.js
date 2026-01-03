import { db } from './utils/firebase.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { username, email, password, whatsapp, product, price, category, ram, cpu, disk } = req.body;

    if (!username || !email || !password || !whatsapp) {
        return res.status(400).json({ error: 'Data tidak lengkap' });
    }

    try {
        const orderId = `ORDER-${new Date().getTime()}-${Math.floor(Math.random() * 1000)}`;

        // BERDASARKAN GAMBAR DOKUMENTASI:
        // 1. URL: https://app.pakasir.com/api/transactioncreate/{method}
        // 2. Method: qris
        // 3. Body Key: "project" (bukan project_id)
        
        const payload = {
            api_key: process.env.PAKASIR_API_KEY,
            project: process.env.PAKASIR_PROJECT_ID, // Sesuai docs key-nya 'project'
            amount: parseInt(price),
            order_id: orderId
        };

        const pakasirReq = await fetch('https://app.pakasir.com/api/transactioncreate/qris', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        // Debugging jika error HTTP
        if (!pakasirReq.ok) {
            const errText = await pakasirReq.text();
            console.error("Pakasir HTTP Error:", pakasirReq.status, errText);
            return res.status(pakasirReq.status).json({ 
                error: `Koneksi Pakasir Gagal (${pakasirReq.status}). Cek Project ID/API Key.` 
            });
        }

        const pakasirRes = await pakasirReq.json();

        // Cek Success (Docs tidak eksplisit soal field success, tapi kita cek response)
        // Biasanya respon sukses berisi key 'transaction' atau 'data'
        if (!pakasirRes.data?.qr_string && !pakasirRes.qr_string && !pakasirRes.transaction?.qr_string) {
            console.error("Pakasir Response Aneh:", JSON.stringify(pakasirRes));
            return res.status(500).json({ error: "Gagal dapat QR. Cek config Pakasir." });
        }

        // Ambil QR String (Support berbagai kemungkinan format respon)
        const qrString = pakasirRes.data?.qr_string || pakasirRes.qr_string || pakasirRes.transaction?.qr_string;

        // Simpan ke Firebase
        // Username yang disimpan disini adalah INPUT AWAL.
        // Nanti Webhook yang akan mengubahnya jika Pterodactyl generate username baru (misal caspertes80)
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
