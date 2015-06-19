import unicodecsv

from postcode import get_lat_lng_4_postcode

from web import db, Expenditure, BUSINESS_TYPES, Premises


def premises_postcodes():
    premises = Premises.query.all()
    c = 0
    for p in premises:
        c += 1
        if p.postcode and not (p.lng and p.lat):
            geo = get_lat_lng_4_postcode(p.postcode)
            if geo:
                p.lng = geo['lng']
                p.lat = geo['lat']
                db.session.add(p)
                db.session.commit()
        if c % 10 == 0:
            print '%s postcodes obtained' % c
    print 'FINISHED %s postcodes obtained' % c


def import_premises():
    f = open('latest.csv')
    r = unicodecsv.reader(f, encoding='utf-8')
    headers = r.next()
    Premises.query.filter_by().delete()
    db.session.commit()
    c = 0
    for row in r:
        if not ('').join(row).strip():
            continue
        c += 1
        row_dict = dict(zip(headers, row))
        prem = Premises(row_dict)
        db.session.add(prem)
        db.session.commit()
        if c % 10 == 0:
            print '%s premises imported' % c
    print 'FINISHED %s premises imported' % c


def import_expenditure():
    '''
    Update the expenditure table
    deleting any data for the city/business_type
    '''
    f = open('expenditure.csv')
    r = unicodecsv.reader(f, encoding='utf-8')
    headers = r.next()
    for row in r:
        row_dict = dict(zip(headers, row))
        assert(row_dict['BUSINESS_TYPE'] in BUSINESS_TYPES)
        Expenditure.query.filter_by(
            city=row_dict['CITY'],
            type=row_dict['BUSINESS_TYPE'],
        ).delete()
        exp = Expenditure(
            city=row_dict['CITY'],
            type=row_dict['BUSINESS_TYPE'],
            spend=row_dict['SPEND_PER_CAPITA'],
        )
        db.session.add(exp)
        db.session.commit()
    print 'Expenditure imported'

#import_expenditure()
import_premises()
premises_postcodes()
