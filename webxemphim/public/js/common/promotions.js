// Promotions Manager

class PromotionsManager {
	constructor() {
		this.vouchers = [];
		this.currentFilter = 'all';
	}

	async loadVouchers() {
		try {
			const response = await fetch('/api/promotions');
			const result = await response.json();

			if (result.ok && Array.isArray(result.data)) {
				this.vouchers = result.data;
				return this.vouchers;
			}
			return [];
		} catch (error) {
			console.error('Error loading vouchers:', error);
			return [];
		}
	}

	getActiveVouchers() {
		return this.vouchers.filter(v => !v.expired);
	}

	getHighValueVouchers() {
		return this.vouchers.filter(v => v.discountAmount >= 50000 && !v.expired);
	}

	getExpiringVouchers() {
		return this.vouchers.filter(v => v.daysRemaining && v.daysRemaining <= 7 && v.daysRemaining > 0);
	}

	getVoucherByCode(code) {
		return this.vouchers.find(v => v.code.toUpperCase() === code.toUpperCase());
	}

	formatDiscount(amount) {
		if (amount >= 1000000) {
			return `${(amount / 1000000).toFixed(0)}M`;
		}
		if (amount >= 1000) {
			return `${(amount / 1000).toFixed(0)}K`;
		}
		return amount.toString();
	}

	formatCurrency(value) {
		return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
	}
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
	module.exports = PromotionsManager;
}
