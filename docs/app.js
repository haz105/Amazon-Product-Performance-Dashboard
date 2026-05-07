class AmazonDashboard {
    constructor() {
        this.currentView = 'executive';
        this.currentCategory = '';
        this.data = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadCategories();
        this.loadInitialData();
    }

    async fetchJson(relPath) {
        const resp = await fetch(relPath, { cache: 'no-cache' });
        return resp.json();
    }

    setupEventListeners() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchView(e.target.closest('.nav-link').dataset.view);
            });
        });

        document.getElementById('category-filter').addEventListener('change', (e) => {
            this.currentCategory = e.target.value;
            this.refreshCurrentView();
        });

        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.refreshCurrentView();
        });
    }

    showLoading() {
        document.getElementById('loading-overlay').classList.add('show');
    }

    hideLoading() {
        document.getElementById('loading-overlay').classList.remove('show');
    }

    async loadCategories() {
        try {
            const products = await this.fetchJson('data/products.json');
            const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))).sort();
            const select = document.getElementById('category-filter');
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    async loadInitialData() {
        this.showLoading();
        try {
            await Promise.all([
                this.loadProducts(),
                this.loadCategoryStats(),
                this.loadExecutiveSummary()
            ]);
            this.renderCurrentView();
        } catch (error) {
            console.error('Error loading initial data:', error);
        } finally {
            this.hideLoading();
        }
    }

    async loadProducts() {
        const all = await this.fetchJson('data/products.json');
        this.data.products = this.currentCategory ? all.filter(p => p.category === this.currentCategory) : all;
    }

    async loadCategoryStats() {
        const products = await this.fetchJson('data/products.json');
        const byCat = {};
        products.forEach(p => {
            if (!p.category) return;
            if (!byCat[p.category]) byCat[p.category] = [];
            byCat[p.category].push(p);
        });
        this.data.categoryStats = Object.entries(byCat).map(([category, arr]) => {
            const prices = arr.map(a => a.price || 0).filter(v => v > 0);
            const ratings = arr.map(a => a.rating || 0).filter(v => v > 0);
            const avg = n => n.length ? (n.reduce((s, v) => s + v, 0) / n.length) : 0;
            return {
                category,
                product_count: arr.length,
                avg_price: avg(prices),
                min_price: prices.length ? Math.min(...prices) : 0,
                max_price: prices.length ? Math.max(...prices) : 0,
                avg_rating: avg(ratings)
            };
        }).sort((a, b) => b.product_count - a.product_count);
    }

    async loadExecutiveSummary() {
        try {
            this.data.executiveSummary = await this.fetchJson('data/executive_summary.json');
        } catch (error) {
            this.data.executiveSummary = null;
        }
    }

    async loadModelReport() {
        try {
            this.data.modelReport = await this.fetchJson('data/model_report.json');
        } catch (error) {
            this.data.modelReport = null;
        }
    }

    async loadFeatureImportance() {
        try {
            this.data.featureImportance = await this.fetchJson('data/feature_importance.json');
        } catch (error) {
            this.data.featureImportance = null;
        }
    }

    switchView(view) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-view="${view}"]`).classList.add('active');

        document.querySelectorAll('.view').forEach(viewEl => {
            viewEl.classList.remove('active');
        });
        document.getElementById(`${view}-view`).classList.add('active');

        this.currentView = view;
        this.updatePageTitle();
        this.renderCurrentView();
    }

    updatePageTitle() {
        const titles = {
            executive: 'Executive Summary',
            market: 'Market Intelligence',
            opportunities: 'Product Opportunities',
            analytics: 'ML Analytics'
        };
        document.getElementById('page-title').textContent = titles[this.currentView];
    }

    async refreshCurrentView() {
        this.showLoading();
        try {
            await this.loadProducts();
            if (this.currentView === 'analytics') {
                await this.loadModelReport();
                await this.loadFeatureImportance();
            }
            this.renderCurrentView();
        } catch (error) {
            console.error('Error refreshing view:', error);
        } finally {
            this.hideLoading();
        }
    }

    renderCurrentView() {
        switch (this.currentView) {
            case 'executive':
                this.renderExecutiveView();
                break;
            case 'market':
                this.renderMarketView();
                break;
            case 'opportunities':
                this.renderOpportunitiesView();
                break;
            case 'analytics':
                this.renderAnalyticsView();
                break;
        }
    }

    renderExecutiveView() {
        this.updateMetrics();
        this.renderCategoryChart();
        this.renderOpportunitiesList();
    }

    updateMetrics() {
        const stats = this.data.categoryStats || [];
        const products = this.data.products || [];
        
        document.getElementById('total-categories').textContent = stats.length;
        document.getElementById('total-products').textContent = products.length;
        
        const avgPrice = products.reduce((sum, p) => sum + (p.price || 0), 0) / products.length;
        document.getElementById('avg-price').textContent = avgPrice ? `$${avgPrice.toFixed(2)}` : '-';
        
        const topCategory = stats.length > 0 ? 
            stats.reduce((a, b) => a.product_count > b.product_count ? a : b).category : '-';
        document.getElementById('top-category').textContent = topCategory;
    }

    renderCategoryChart() {
        const container = document.getElementById('category-chart');
        container.innerHTML = '';

        if (!this.data.categoryStats || this.data.categoryStats.length === 0) {
            container.innerHTML = '<p>No category data available</p>';
            return;
        }

        const margin = { top: 20, right: 30, bottom: 40, left: 40 };
        const width = container.offsetWidth - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .domain(this.data.categoryStats.map(d => d.category))
            .range([0, width])
            .padding(0.1);

        const y = d3.scaleLinear()
            .domain([0, d3.max(this.data.categoryStats, d => d.product_count)])
            .range([height, 0]);

        g.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll('text')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .attr('transform', 'rotate(-45)');

        g.append('g')
            .call(d3.axisLeft(y));

        const tooltip = d3.select('body').append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0);

        g.selectAll('.bar')
            .data(this.data.categoryStats)
            .enter().append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.category))
            .attr('width', x.bandwidth())
            .attr('y', d => y(d.product_count))
            .attr('height', d => height - y(d.product_count))
            .on('mouseover', (event, d) => {
                tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);
                tooltip.html(`Category: ${d.category}<br/>Products: ${d.product_count}<br/>Avg Price: $${(d.avg_price || 0).toFixed(2)}`)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', () => {
                tooltip.transition()
                    .duration(500)
                    .style('opacity', 0);
            });
    }

    renderOpportunitiesList() {
        const container = document.getElementById('opportunities-list');
        container.innerHTML = '';

        if (!this.data.executiveSummary || !this.data.executiveSummary.categories) {
            container.innerHTML = '<p>Run analytics to generate opportunities</p>';
            return;
        }

        const opportunities = [];
        Object.entries(this.data.executiveSummary.categories).forEach(([category, data]) => {
            if (data.top_opportunities) {
                data.top_opportunities.slice(0, 3).forEach(opp => {
                    opportunities.push({
                        category,
                        action: opp.action || 'Optimize pricing',
                        score: opp.opportunity_score || Math.random() * 100
                    });
                });
            }
        });

        if (opportunities.length === 0) {
            container.innerHTML = '<p>No opportunities identified</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Action</th>
                    <th>Score</th>
                </tr>
            </thead>
            <tbody>
                ${opportunities.map(opp => `
                    <tr>
                        <td>${opp.category}</td>
                        <td>${opp.action}</td>
                        <td>${opp.score.toFixed(1)}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        container.appendChild(table);
    }

    renderMarketView() {
        this.renderPriceRatingChart();
        this.renderPriceDistribution();
        this.renderMarketLeaders();
    }

    async renderPriceRatingChart() {
        const container = document.getElementById('price-rating-chart');
        container.innerHTML = '';

        try {
            const all = await this.fetchJson('data/products.json');
            const data = (this.currentCategory ? all.filter(p => p.category === this.currentCategory) : all)
                .filter(p => p.price && p.rating);

            if (!data || data.length === 0) {
                container.innerHTML = '<p>No price/rating data available</p>';
                return;
            }

            const margin = { top: 20, right: 30, bottom: 40, left: 40 };
            const width = container.offsetWidth - margin.left - margin.right;
            const height = 400 - margin.top - margin.bottom;

            const svg = d3.select(container)
                .append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom);

            const g = svg.append('g')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            const x = d3.scaleLinear()
                .domain(d3.extent(data, d => d.price))
                .range([0, width]);

            const y = d3.scaleLinear()
                .domain(d3.extent(data, d => d.rating))
                .range([height, 0]);

            const radius = d3.scaleSqrt()
                .domain(d3.extent(data, d => d.review_count))
                .range([2, 10]);

            g.append('g')
                .attr('transform', `translate(0,${height})`)
                .call(d3.axisBottom(x));

            g.append('g')
                .call(d3.axisLeft(y));

            g.append('text')
                .attr('transform', 'rotate(-90)')
                .attr('y', 0 - margin.left)
                .attr('x', 0 - (height / 2))
                .attr('dy', '1em')
                .style('text-anchor', 'middle')
                .text('Rating');

            g.append('text')
                .attr('transform', `translate(${width / 2}, ${height + margin.bottom})`)
                .style('text-anchor', 'middle')
                .text('Price ($)');

            const tooltip = d3.select('body').append('div')
                .attr('class', 'tooltip')
                .style('opacity', 0);

            g.selectAll('.scatter-dot')
                .data(data)
                .enter().append('circle')
                .attr('class', 'scatter-dot')
                .attr('cx', d => x(d.price))
                .attr('cy', d => y(d.rating))
                .attr('r', d => radius(d.review_count))
                .on('mouseover', (event, d) => {
                    tooltip.transition()
                        .duration(200)
                        .style('opacity', .9);
                    tooltip.html(`${d.title}<br/>Price: $${d.price}<br/>Rating: ${d.rating}<br/>Reviews: ${d.review_count}`)
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 28) + 'px');
                })
                .on('mouseout', () => {
                    tooltip.transition()
                        .duration(500)
                        .style('opacity', 0);
                });

        } catch (error) {
            console.error('Error rendering price-rating chart:', error);
            container.innerHTML = '<p>Error loading chart data</p>';
        }
    }

    renderPriceDistribution() {
        const container = document.getElementById('price-distribution-chart');
        container.innerHTML = '';

        const products = this.data.products || [];
        const prices = products.map(p => p.price).filter(p => p && p > 0);

        if (prices.length === 0) {
            container.innerHTML = '<p>No price data available</p>';
            return;
        }

        const margin = { top: 20, right: 30, bottom: 40, left: 40 };
        const width = container.offsetWidth - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear()
            .domain(d3.extent(prices))
            .range([0, width]);

        const histogram = d3.histogram()
            .value(d => d)
            .domain(x.domain())
            .thresholds(x.ticks(20));

        const bins = histogram(prices);

        const y = d3.scaleLinear()
            .domain([0, d3.max(bins, d => d.length)])
            .range([height, 0]);

        g.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x));

        g.append('g')
            .call(d3.axisLeft(y));

        g.selectAll('.bar')
            .data(bins)
            .enter().append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.x0))
            .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 1))
            .attr('y', d => y(d.length))
            .attr('height', d => height - y(d.length));
    }

    renderMarketLeaders() {
        const container = document.getElementById('market-leaders-list');
        container.innerHTML = '';

        const products = this.data.products || [];
        const leaders = products
            .filter(p => p.rating >= 4.0 && p.review_count >= 100)
            .sort((a, b) => (b.rating * Math.log(b.review_count)) - (a.rating * Math.log(a.review_count)))
            .slice(0, 10);

        if (leaders.length === 0) {
            container.innerHTML = '<p>No market leaders identified</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Rating</th>
                    <th>Reviews</th>
                </tr>
            </thead>
            <tbody>
                ${leaders.map(product => `
                    <tr>
                        <td>${product.title.substring(0, 50)}...</td>
                        <td>$${product.price}</td>
                        <td>${product.rating}</td>
                        <td>${product.review_count}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        container.appendChild(table);
    }

    renderOpportunitiesView() {
        this.renderUnderpricedProducts();
        this.renderHighPotentialProducts();
        this.renderSentimentChart();
    }

    renderUnderpricedProducts() {
        const container = document.getElementById('underpriced-products');
        container.innerHTML = '';

        const products = this.data.products || [];
        const validProducts = products.filter(p => p.price && p.rating >= 4.0);
        
        if (validProducts.length === 0) {
            container.innerHTML = '<p>No product data available</p>';
            return;
        }

        const q75 = d3.quantile(validProducts.map(p => p.price).sort(d3.ascending), 0.75);
        const underpriced = validProducts
            .filter(p => p.price <= q75 && p.rating >= 4.5)
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 10);

        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Rating</th>
                    <th>Opportunity</th>
                </tr>
            </thead>
            <tbody>
                ${underpriced.map(product => {
                    const opportunity = ((5.0 - product.rating) * -1 + 1) * 100;
                    return `
                        <tr>
                            <td>${product.title.substring(0, 40)}...</td>
                            <td>$${product.price}</td>
                            <td>${product.rating}</td>
                            <td>${opportunity.toFixed(1)}%</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        `;
        container.appendChild(table);
    }

    renderHighPotentialProducts() {
        const container = document.getElementById('high-potential-products');
        container.innerHTML = '';

        const products = this.data.products || [];
        const potential = products
            .filter(p => p.rating >= 4.0 && p.review_count < 1000)
            .sort((a, b) => b.rating - a.rating)
            .slice(0, 10);

        if (potential.length === 0) {
            container.innerHTML = '<p>No high potential products found</p>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Rating</th>
                    <th>Reviews</th>
                    <th>Potential</th>
                </tr>
            </thead>
            <tbody>
                ${potential.map(product => `
                    <tr>
                        <td>${product.title.substring(0, 40)}...</td>
                        <td>${product.rating}</td>
                        <td>${product.review_count}</td>
                        <td>High</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        container.appendChild(table);
    }

    async renderSentimentChart() {
        const container = document.getElementById('sentiment-chart');
        container.innerHTML = '<p>Sentiment analysis requires review data processing</p>';
    }

    async renderAnalyticsView() {
        await this.loadModelReport();
        await this.loadFeatureImportance();
        this.renderModelMetrics();
        this.renderFeatureImportanceChart();
        this.renderPredictionAccuracy();
    }

    renderModelMetrics() {
        const container = document.getElementById('model-metrics');
        container.innerHTML = '';

        if (!this.data.modelReport || !this.data.modelReport.models) {
            container.innerHTML = '<p>Run predictive models to generate metrics</p>';
            return;
        }

        const models = this.data.modelReport.models;
        const modelKeys = Object.keys(models);

        if (modelKeys.length === 0) {
            container.innerHTML = '<p>No model metrics available</p>';
            return;
        }

        const category = this.currentCategory || modelKeys[0];
        const metrics = models[category];

        if (!metrics) {
            container.innerHTML = '<p>No metrics for selected category</p>';
            return;
        }

        const html = `
            <div class="metrics-summary">
                <h4>Price Prediction Model</h4>
                <p>R² Score: ${(metrics.price_prediction?.r2 || 0).toFixed(3)}</p>
                <p>MAE: ${(metrics.price_prediction?.mae || 0).toFixed(2)}</p>
                
                <h4>Success Prediction Model</h4>
                <p>Accuracy: ${(metrics.success_prediction?.accuracy || 0).toFixed(3)}</p>
                <p>Precision: ${(metrics.success_prediction?.precision || 0).toFixed(3)}</p>
                <p>Recall: ${(metrics.success_prediction?.recall || 0).toFixed(3)}</p>
            </div>
        `;
        container.innerHTML = html;
    }

    renderFeatureImportanceChart() {
        const container = document.getElementById('feature-importance-chart');
        container.innerHTML = '';

        if (!this.data.featureImportance) {
            container.innerHTML = '<p>Feature importance data not available</p>';
            return;
        }

        const category = this.currentCategory || Object.keys(this.data.featureImportance)[0];
        const key = `${category}_price`;
        const features = this.data.featureImportance[key];

        if (!features || !Array.isArray(features)) {
            container.innerHTML = '<p>No feature importance data for this category</p>';
            return;
        }

        const margin = { top: 20, right: 30, bottom: 40, left: 100 };
        const width = container.offsetWidth - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const sortedFeatures = features.sort((a, b) => b.importance - a.importance).slice(0, 10);

        const x = d3.scaleLinear()
            .domain([0, d3.max(sortedFeatures, d => d.importance)])
            .range([0, width]);

        const y = d3.scaleBand()
            .domain(sortedFeatures.map(d => d.feature))
            .range([0, height])
            .padding(0.1);

        g.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x));

        g.append('g')
            .call(d3.axisLeft(y));

        g.selectAll('.bar')
            .data(sortedFeatures)
            .enter().append('rect')
            .attr('class', 'bar')
            .attr('x', 0)
            .attr('y', d => y(d.feature))
            .attr('width', d => x(d.importance))
            .attr('height', y.bandwidth());
    }

    renderPredictionAccuracy() {
        const container = document.getElementById('prediction-accuracy-chart');
        container.innerHTML = '<p>Prediction accuracy visualization requires model validation data</p>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AmazonDashboard();
});
