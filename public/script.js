let currentSoundsData = [];

async function detectSounds() {
    const userId = document.getElementById('userIdInput').value.trim();
    const btn = document.getElementById('detectBtn');
    const status = document.getElementById('status');
    const resultArea = document.getElementById('resultArea');

    if (!userId) {
        alert('User ID gak boleh kosong bro!');
        return;
    }

    btn.disabled = true;
    btn.innerText = 'Scanning...';
    status.innerText = '⏳ Sedang scanning & mengecek status audio... Mohon tunggu.';
    status.classList.remove('hidden');
    status.className = 'text-center text-yellow-400 mb-4';
    resultArea.classList.add('hidden');

    try {
        const response = await fetch('/api/detect-sounds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Terjadi kesalahan pada server');
        }

        currentSoundsData = data.sounds;
        document.getElementById('totalSounds').innerText = data.totalSounds;
        
        const tbody = document.getElementById('soundTableBody');
        tbody.innerHTML = ''; 

        data.sounds.forEach(sound => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700 hover:bg-gray-800';
            
            // Logic Warna Status
            let statusHtml = '';
            if (sound.status === 'ACTIVE') {
                statusHtml = `<span class="px-2 py-1 bg-green-900 text-green-300 rounded text-xs font-bold">✅ ACTIVE</span>`;
            } else if (sound.status === 'DELETED / COPYRIGHT') {
                statusHtml = `<span class="px-2 py-1 bg-red-900 text-red-300 rounded text-xs font-bold">❌ DELETED / COPYRIGHT</span>`;
            } else if (sound.status === 'DELETED / COPYRIGHT (moderated)') {
                statusHtml = `<span class="px-2 py-1 bg-red-900 text-red-300 rounded text-xs font-bold">❌ DELETED / COPYRIGHT (moderated)</span>`;
            } else {
                statusHtml = `<span class="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs font-bold">❔ UNKNOWN / ERROR</span>`;
            }

            const createdText = sound.created
                ? new Date(sound.created).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })
                : '-';

            row.innerHTML = `
                <td class="px-4 py-2 font-mono text-blue-300">${sound.assetId}</td>
                <td class="px-4 py-2 text-gray-300">${sound.name}</td>
                <td class="px-4 py-2">${statusHtml}</td>
                <td class="px-4 py-2 text-gray-400 text-xs">${createdText}</td>
            `;
            tbody.appendChild(row);
        });

        status.innerText = `✅ Selesai! Berhasil mendeteksi ${data.totalSounds} sound.`;
        status.className = 'text-center text-green-400 mb-4';
        resultArea.classList.remove('hidden');

    } catch (error) {
        status.innerText = ` Error: ${error.message}`;
        status.className = 'text-center text-red-400 mb-4';
    } finally {
        btn.disabled = false;
        btn.innerText = 'Detect';
    }
}

function copyAllIds() {
    if (currentSoundsData.length === 0) return;
    const ids = currentSoundsData.map(s => s.assetId).join('\n');
    navigator.clipboard.writeText(ids).then(() => {
        alert('Semua Asset ID berhasil di-copy!');
    });
}

function downloadCsv() {
    if (currentSoundsData.length === 0) return;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Asset ID,Name,Status,Created\n";

    currentSoundsData.forEach(row => {
        const safeName = row.name.replace(/"/g, '""');
        const createdCsv = row.created ? new Date(row.created).toISOString().split('T')[0] : '';
        csvContent += `${row.assetId},"${safeName}",${row.status},${createdCsv}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "roblox_sounds.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
