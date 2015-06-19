import os
from collections import defaultdict

from flask import Flask, render_template, jsonify, request, abort
from flask.ext.sqlalchemy import SQLAlchemy
from datetime import datetime

from config import config

app = Flask(__name__)
app.config.update(config)

db = SQLAlchemy(app)

HTML_PAGES = [
    'home',
    'businesses',
    'councils',
    'landlords',
]

HIDDEN_BUS_TYPES = [
    'HOTEL',
    'EDU',
    'ACCOM',
    'TRANSPORT',
    'COUNCIL',
    'NONCOM',
]

BUSINESS_TYPES = {
    'FOOD': 'Food & non-alcoholic drinks',
    'ALCOHOL': 'Alcoholic drinks, tobacco & narcotics',
    'CLOTHES': 'Clothing & footwear',
    'ACCOM': 'Housing, fuel & power',
    'HOUSEHOLD': 'Household goods & services',
    'HEALTH': 'Health',
    'TRANSPORT': 'Transport',
    'COMMS': 'Communication',
    'REC': 'Recreation & culture',
    'EDU': 'Education',
    'REST': 'Catering services',
    'HOTEL': 'Accommodation services',
    'PSERV': 'Personal services',
    'MISC': 'Miscellaneous goods & services',
    'COUNCIL': 'Local Council Service',
    'NONCOM': 'Non-revenue-generating site',
}


FIELD_CONVERT_PREMISES = {
    'LON': 'LNG',
    'ASSESSED_REVENUE': 'REVENUE',
    'ASSESSED_EMPLOYMENT_COUNT': 'EMPLOY_COUNT',
    'ASSESSED_EMPLOYMENT_COST': 'EMPLOY_COST',
}


def fn_vacant(value):
    return bool(value.lower() == 'y')


def make_date(value):
    try:
        value = datetime.strptime(value, "%d/%m/%Y")
    except:
        value = None
    return value


def make_float(value):
    value = value.replace(',', '')
    try:
        value = float(value)
    except:
        value = None
    return value


def make_int(value):
    value = value.replace(',', '')
    try:
        value = int(value)
    except:
        try:
            value = int(float(value))
        except:
            value = None
    return value


def make_business_type(value):
    if value in BUSINESS_TYPES:
        return value
    if value == 'VACANT':
        return None
    raise Exception('Unknown business type %s' % value)

VALUE_CONVERSION_FN_PREMISES = {
    'VACANT': fn_vacant,
    'RATES_START': make_date,
    'EMPTY_FROM': make_date,
    'RENT_VAL': make_int,
    'SIZE_M2': make_float,
    'LAT': make_float,
    'LNG': make_float,
    'FOOTFALL': make_float,
    'REVENUE': make_int,
    'EMPLOY_COUNT': make_float,
    'EMPLOY_COST': make_int,
    'BUS_TYPE': make_business_type,
}


class Expenditure(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    city = db.Column(db.String(80))
    type = db.Column(db.String(80))
    spend = db.Column(db.Float)

    def __init__(self, city, type, spend):
        self.city = city
        self.type = type
        self.spend = spend

    def __repr__(self):
        return '<Expenditure %r>' % self.type


class Premises(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    city = db.Column(db.String(80))
    ref = db.Column(db.String(80))
    rates_start = db.Column(db.Date)
    vacant = db.Column(db.Boolean)
    empty_from = db.Column(db.Date)
    rent_val = db.Column(db.Float)
    size_m2 = db.Column(db.Float)
    business_name = db.Column(db.String(250))
    add1 = db.Column(db.String(250))
    add2 = db.Column(db.String(250))
    add3 = db.Column(db.String(250))
    add4 = db.Column(db.String(250))
    add5 = db.Column(db.String(250))
    postcode = db.Column(db.String(10))
    outcode = db.Column(db.String(10))
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    bus_type = db.Column(db.String(80))
    rate_payer = db.Column(db.String(80))
    foot_grp = db.Column(db.String(250))
    footfall = db.Column(db.Float)
    revenue = db.Column(db.Float)
    employ_count = db.Column(db.Float)
    employ_cost = db.Column(db.Float)

    def __init__(self, data):
        for key, value in data.items():
            if key in FIELD_CONVERT_PREMISES:
                key = FIELD_CONVERT_PREMISES[key]
            if key in VALUE_CONVERSION_FN_PREMISES:
                value = VALUE_CONVERSION_FN_PREMISES[key](value)
            setattr(self, key.lower(), value)
        # set outcode
        if data.get('POSTCODE'):
            self.outcode = data.get('POSTCODE').split()[0]

    def __repr__(self):
        return '<Premises %s>' % self.id


db.create_all()


@app.route("/feed")
def feed():
    fields = [
        'id',
        'bus_type',
        'business_name',
        'lat',
        'lng',
        'revenue',
        'rent_val',
        'rate_payer',
        'vacant',
        'employ_cost',
        'employ_count',
        'size_m2',
    ]

    private_fields = [
    ]

    cols = []
    col_names = []
    for field in fields + private_fields:
        cols.append(getattr(Premises, field))
        col_names.append(field)

    results = Premises.query.with_entities(
        *cols
    )
  #  city = request.args.get('city')
  #  if city:
  #      results = results.filter_by(city=city)
    outcode = request.args.get('outcode')
    if outcode:
        results = results.filter_by(outcode=outcode)
    results = results.filter(Premises.size_m2 > 2)
    results = results.all()

    # sort business types for front end
    business_types = [[k, v, k in HIDDEN_BUS_TYPES] for k, v in BUSINESS_TYPES.items()]
    business_types.sort(key=lambda x: x[1])

    # potential revenues
    col_size_m2 = col_names.index('size_m2')
    col_bus_type = col_names.index('bus_type')
    col_revenue = col_names.index('revenue')
    col_vacant = col_names.index('vacant')
    col_rent_val = col_names.index('rent_val')
    col_employ_cost = col_names.index('employ_cost')

    size_dict = defaultdict(int)
    revenue_dict = defaultdict(int)

    for result in results:
        bus_type = result[col_bus_type]
        if bus_type:
            size_dict[bus_type] += result[col_size_m2] or 0
            revenue_dict[bus_type] += result[col_revenue] or 0


    num_private_fields = len(private_fields)
    for index in xrange(len(results)):
        result = results[index]
        if result[col_vacant]:
            revenue = make_revenue(result, size_dict, revenue_dict)
            rating = best_rating(revenue)
        else:
            revenue = {}
            rating = make_rating(
                result[col_employ_cost],
                result[col_rent_val],
                result[col_revenue]
            )

            print (
                result[col_employ_cost],
                result[col_rent_val],
                result[col_revenue]
            )
        if num_private_fields:
            result = result[:-num_private_fields]
        results[index] = result + (revenue, rating)
    fields.append('revenue_potential')
    fields.append('rating')

    return jsonify(
        fields=fields,
        data=results,
        business_types=business_types,
        outcode=outcode,
    )

def best_rating(revenue):
    return revenue[0][2]


@app.route("/areas")
def areas():
    fields = [
        'city',
        'outcode',
    ]

    cols = []
    col_names = []
    for field in fields:
        cols.append(getattr(Premises, field))
        col_names.append(field)

    areas = Premises.query.with_entities(
        *cols
    ).distinct().all()

    output = []
    for row in areas:
        out = {}
        for index, field in enumerate(fields):
            out[field] = row[index]
        output.append(out)

    return jsonify(
        areas=output,
    )


def make_rating(employ_cost, rent_val, revenue):
    if not (revenue and employ_cost and rent_val):
        return None
    rating = (employ_cost + rent_val)/ revenue
    return [rating, quick_rating(rating)]


def quick_rating(rating):
    if rating < 0.9:
        return 2
    if rating > 1.1:
        return 0
    return 1


def make_revenue(item, size_dict, revenue_dict):
    out = []
    if item.size_m2 and item.rent_val:
        for bus_type in size_dict:
            ass_revenue = (revenue_dict[bus_type] / (size_dict[bus_type] + item.size_m2) * item.size_m2)
            if not ass_revenue:
                continue
            rating = make_rating(
                item.employ_cost,
                item.rent_val,
                ass_revenue
            )
            out.append([
                bus_type,
                ass_revenue,
                rating,
            ])
        out.sort(key=lambda x: x[2])
    return out


@app.route("/feed_premisis/<id>")
def feed_premisis(id):
    fields = [
        'id',
        'bus_type',
        'business_name',
        'lat',
        'lng',
        'revenue',
        'vacant',
        ]

    result = Premises.query.filter_by(id=id).first_or_404()
    output = {}
    for field in fields:
        output[field] = getattr(result, field)
    return jsonify(data=output)


@app.route("/feed_page/<page>")
def feed_page(page):
    if not page:
        page = 'home'
    if page not in HTML_PAGES:
        return abort(404)
    return render_template('%s.html' % page)


@app.route("/")
def hello():
    return render_template('map.html')

if __name__ == "__main__":
    app.run()
