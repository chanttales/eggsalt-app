-- Money in that isn't a customer payment or a supplier refund (e.g. selling empty trays). The
-- record_money step action has an "income" kind that posts here.

alter type money_kind add value 'other_income' after 'supplier_refund';
