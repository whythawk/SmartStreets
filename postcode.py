import urllib2
import json


def get_lat_lng_4_postcode1(postcode):
    BASE = 'https://alpha.openaddressesuk.org/addresses.json?postcode=%s'
    postcode = postcode.replace(' ', '').lower()
    try:
        data = urllib2.urlopen(BASE % postcode).read()
        info = json.loads(data)
        addresses = info.get('addresses')

        coords = []
        for address in addresses:
            geo = address['postcode']['geo']
            coords.append([geo['latitude'], geo['longitude']])
        averages = [sum(items) / len(coords) for items in zip(*coords)]
        return {'lat': averages[0], 'lng': averages[1]}
    except:
        return None


def get_lat_lng_4_postcode2(postcode):
    BASE = 'http://uk-postcodes.com/postcode/%s.json'
    postcode = postcode.replace(' ', '').lower()
    try:
        data = urllib2.urlopen(BASE % postcode).read()
        info = json.loads(data)
        geo = info['geo']
        return {'lat': geo['lat'], 'lng': geo['lng']}
    except:
        return None



def get_lat_lng_4_postcode(postcode):
    return (get_lat_lng_4_postcode1(postcode) or
            get_lat_lng_4_postcode2(postcode))
