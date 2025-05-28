document.addEventListener('DOMContentLoaded', async function() {
    // Configuração inicial
    document.getElementById('ano').textContent = new Date().getFullYear();
    document.getElementById('data').valueAsDate = new Date();

    // Carregar estados ao iniciar
    await carregarEstados();

    // Quando estado mudar, carregar cidades
    document.getElementById('estado').addEventListener('change', async function() {
        const uf = this.value;
        await carregarCidades(uf);
    });

    // Formulário
    document.getElementById('horariosForm').addEventListener('submit', function(e) {
        e.preventDefault();
        calcularHorarios();
    });
});

// Função para carregar estados do IBGE
async function carregarEstados() {
    try {
        const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
        const estados = await response.json();
        const selectEstado = document.getElementById('estado');
        
        estados.sort((a, b) => a.nome.localeCompare(b.nome));
        
        estados.forEach(estado => {
            const option = document.createElement('option');
            option.value = estado.sigla;
            option.textContent = estado.nome;
            selectEstado.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar estados:', error);
        alert('Não foi possível carregar a lista de estados. Por favor, tente novamente mais tarde.');
    }
}

// Função para carregar cidades do IBGE
async function carregarCidades(uf) {
    const selectCidade = document.getElementById('cidade');
    
    try {
        selectCidade.disabled = true;
        selectCidade.innerHTML = '<option value="" selected disabled>Carregando cidades...</option>';
        
        const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
        const cidades = await response.json();
        
        selectCidade.innerHTML = '';
        
        cidades.sort((a, b) => a.nome.localeCompare(b.nome));
        
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.selected = true;
        defaultOption.disabled = true;
        defaultOption.textContent = 'Selecione sua cidade';
        selectCidade.appendChild(defaultOption);
        
        cidades.forEach(cidade => {
            const option = document.createElement('option');
            option.value = cidade.nome;
            option.textContent = cidade.nome;
            option.dataset.uf = uf;
            selectCidade.appendChild(option);
        });
        
        selectCidade.disabled = false;
    } catch (error) {
        console.error('Erro ao carregar cidades:', error);
        selectCidade.innerHTML = '<option value="" selected disabled>Erro ao carregar cidades</option>';
    }
}

// Função para obter coordenadas exatas com geocoding
async function obterCoordenadasExatas(cidadeNome, uf) {
    // Cache simples no localStorage
    const cacheKey = `coords_${uf}_${cidadeNome}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);

    // 1. Tentar com Nominatim (OpenStreetMap)
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(cidadeNome)}&state=${encodeURIComponent(uf)}&country=Brazil&format=json`);
        const data = await response.json();
        
        if (data.length > 0) {
            const resultado = {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
                alt: data[0].elevation ? parseFloat(data[0].elevation) : 0
            };
            localStorage.setItem(cacheKey, JSON.stringify(resultado));
            return resultado;
        }
    } catch (error) {
        console.error("Erro na API Nominatim:", error);
    }

    // 2. Fallback para coordenadas aproximadas
    const coordsAproximadas = obterCoordenadasAproximadas(cidadeNome, uf);
    return coordsAproximadas;
}

// Função fallback para coordenadas aproximadas
function obterCoordenadasAproximadas(cidadeNome, uf) {
    const cidadesPrincipais = {
        "São Paulo": { lat: -23.5505, lng: -46.6333, alt: 760 },
        "Rio de Janeiro": { lat: -22.9068, lng: -43.1729, alt: 2 },
        // Adicione mais cidades conforme necessário
    };

    if (cidadesPrincipais[cidadeNome]) {
        return cidadesPrincipais[cidadeNome];
    }

    const capitaisPorEstado = {
        "AC": { lat: -9.9747, lng: -67.8100, alt: 143 },
        "AL": { lat: -9.6653, lng: -35.7353, alt: 16 },
        // Complete para todos os estados...
        "SP": { lat: -23.5505, lng: -46.6333, alt: 760 },
        "RJ": { lat: -22.9068, lng: -43.1729, alt: 2 }
    };

    return capitaisPorEstado[uf] || { lat: -15.7801, lng: -47.9292, alt: 1172 }; // Brasília
}

// Função principal para calcular os horários
async function calcularHorarios() {
    const estado = document.getElementById('estado').value;
    const cidadeNome = document.getElementById('cidade').value;
    const dataSelecionada = new Date(document.getElementById('data').value);
    
    if (!estado || !cidadeNome || !dataSelecionada) {
        alert('Por favor, selecione estado, cidade e data');
        return;
    }
    
    try {
        // Obter coordenadas exatas
        const { lat, lng, alt } = await obterCoordenadasExatas(cidadeNome, estado);
        
        // Obter dados astronômicos precisos
        const dataFormatada = dataSelecionada.toISOString().split('T')[0];
        const apiUrl = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${dataFormatada}&formatted=0`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.status !== 'OK') throw new Error('Falha na API astronômica');
        
        // Converter para horário local
        const sunrise = new Date(data.results.sunrise);
        const sunset = new Date(data.results.sunset);
        const solarNoon = new Date(data.results.solar_noon);
        
        // Duração do dia em minutos
        const duracaoDiaMinutos = (sunset - sunrise) / (1000 * 60);
        const horaHalachica = duracaoDiaMinutos / 12;
        
        // Cálculos haláchicos
        const fimShacharit = new Date(sunrise.getTime() + (4 * horaHalachica * 60 * 1000));
        const minchaGedola = new Date(solarNoon.getTime() + (30 * 60 * 1000));
        const minchaKetana = new Date(sunset.getTime() - (2.5 * horaHalachica * 60 * 1000));
        const arvit = new Date(sunset.getTime() + (0.5 * horaHalachica * 60 * 1000));
        
        // Shabbat
        const velasShabbat = new Date(sunset.getTime() - (18 * 60 * 1000));
        const havdala = new Date(sunset.getTime() + (45 * 60 * 1000));
        
        // Exibir resultados
        document.getElementById('nascer-sol').textContent = formatarHora(sunrise);
        document.getElementById('por-sol').textContent = formatarHora(sunset);
        document.getElementById('duracao-dia').textContent = `${Math.floor(duracaoDiaMinutos / 60)}h ${Math.floor(duracaoDiaMinutos % 60)}m`;
        document.getElementById('meio-dia').textContent = formatarHora(solarNoon);
        
        document.getElementById('shema').innerHTML = `
            De ${formatarHora(sunrise)} até ${formatarHora(fimShacharit)}
        `;
        
        document.getElementById('mincha-gedola').textContent = formatarHora(minchaGedola);
        document.getElementById('mincha-ketana').textContent = formatarHora(minchaKetana);
        document.getElementById('arvit').textContent = `${formatarHora(arvit)} (30 minutos haláchicos após o pôr do sol)`;
        
        // Mostrar card de Shabbat apenas para sexta-feira
        const shabbatCard = document.getElementById('shabbat-card');
        if (dataSelecionada.getDay() === 5) {
            shabbatCard.classList.remove('d-none');
            document.getElementById('velas-shabbat').textContent = formatarHora(velasShabbat);
            document.getElementById('havdala').textContent = formatarHora(havdala);
        } else {
            shabbatCard.classList.add('d-none');
        }
        
        document.getElementById('hora-halachica').textContent = horaHalachica.toFixed(1);
        document.getElementById('resultados').classList.remove('d-none');
        
    } catch (error) {
        console.error('Erro ao calcular horários:', error);
        alert('Ocorreu um erro ao calcular os horários. Por favor, tente novamente.');
    }
}

// Função para formatar hora considerando fuso horário
function formatarHora(data) {
    const options = {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
    return data.toLocaleTimeString('pt-BR', options);
}