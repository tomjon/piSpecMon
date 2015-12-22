# delete old data once in a while, but mostly rely on a query filter to exclude old data
# (otherwise if you delete too often ES gets into a mess)
n=`date +%s`
m=`expr $n - 10`
p=`expr $m \* 1000`
curl -XDELETE "http://localhost:9200/spectrum/signal/_query?pretty" -d '{"query":{"range":{"_timestamp":{"lte": '$p'}}}}'
