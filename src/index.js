const m = require('mithril')
const stream = require('mithril/stream')
const sst = require('static-sum-type/configs/dev/foldThrow.js')
const yslashn = require('static-sum-type/modules/yslashn')
const actions$ = stream()

const encase = ({Y,N}) => f => (...xs) => {
    try {
        return Y(f(...xs))
    } catch(e){
        return N(e)
    }
}

const Maybe = yslashn.maybe('Maybe')
    Maybe.encase = encase(Maybe)

Maybe.map = sst.map( Maybe )
Maybe.chain = f => fold(Maybe)({
    Y: (a) => f(a).value
    ,N: Maybe.N
})

const querySelector = Maybe.encase( 
    (node, selector) => node.querySelector(selector)
)

const model$ = stream.scan(function(p, n){

    DOMSideEffects(p,n)

    if( n.type == 'UPDATE_FEED_VALUE' ){
        return {
            feedurl: n.value
            ,feedraw: null
            ,feedparsed: null
        }
    } else if ( n.type == 'FETCH_FEED' ){
        return p
    } else if ( n.type == 'PARSE_FEED' ){
        return p
    } else {
        return p
    }

    return p
}, { feedurl: '', feedraw: null, feedparsed: null }, actions$)

function DOMSideEffects(p, n){
    
    window.state = p

    if( n.type == 'FETCH_FEED' ){
        m.request({
            url: 'https://cors.now.sh/'+p.feedurl
            ,deserialize: i => i
            ,method: 'GET'
        })
            .then(function(response){
                p.feedraw = response
                actions$({
                    type: 'PARSE_FEED'
                })
            })
    } else if (n.type == 'PARSE_FEED'){

        const xml = new DOMParser().parseFromString(
            p.feedraw
                .replace(/itunes:/g, 'itunes_')
            , 'application/xml'
        )

        const defaultNode = { innerHTML: '', getAttribute: () => '' } 
        const xmlItems = Array.from(xml.querySelectorAll('item'))

        const xmlChannel = xml.querySelector('channel')
        
        const channel = {
            title: (xmlChannel.querySelector('title') || defaultNode).innerHTML
            ,link: (xmlChannel.querySelector('link') || defaultNode).innerHTML
            ,language: (xmlChannel.querySelector('language') || defaultNode).innerHTML
            ,copyright: (xmlChannel.querySelector('copyright') || defaultNode).innerHTML
            ,description: (xmlChannel.querySelector('description') || defaultNode).innerHTML
            ,itunesType: (xmlChannel.querySelector('itunes_type') || defaultNode).innerHTML
            ,itunesImageHref: (xmlChannel.querySelector('itunes_image') || defaultNode).getAttribute('href')
            ,items:
                xmlItems.map(function(xml){
                    return {
                        title: (xml.querySelector('description') || defaultNode).innerHTML
                        ,description: (xml.querySelector('description') || defaultNode).innerHTML
                        ,pubDate: (xml.querySelector('pubDate') || defaultNode).innerHTML
                        ,itunesAuthor: (xml.querySelector('itunes_author') || defaultNode).innerHTML
                        ,itunesTitle: (xml.querySelector('itunes_title') || defaultNode).innerHTML
                        ,itunesEpisodeType: (xml.querySelector('itunes_subtitle') || defaultNode).innerHTML
                        ,itunesDuration: (xml.querySelector('itunes_duration') || defaultNode).innerHTML
                        ,itunesExplicit: (xml.querySelector('itunes_explicit') || defaultNode).innerHTML
                        ,enclosure: {
                            type: (xml.querySelector('enclosure') || defaultNode).getAttribute('type')
                            ,length: (xml.querySelector('enclosure') || defaultNode).getAttribute('length')
                            ,url: (xml.querySelector('enclosure') || defaultNode).getAttribute('url')
                        }
                    }
                })
        }

        state.feedparsed = channel  

    }
}



const view$ = model$.map(function(model){
    return m(
        'div'
        , m('input'
            , { oninput: 
                m.withAttr('value', function(value){
                    actions$({
                        type: 'UPDATE_FEED_VALUE',
                        value
                    })
                })
            }
        )
        , m('button', {
            onclick(){
                actions$({
                    type: 'FETCH_FEED'
                })
            }
        }, 'Fetch')
        ,m('p', 'https://feeds.feedburner.com/InterceptedWithJeremyScahill')
    )
})  

view$.map( x => m.render(document.body, x) )